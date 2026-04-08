import {
  GUARDRAIL_REJECTION_MESSAGE,
  QUERY_PLAN_SYSTEM_PROMPT,
  RESPONSE_SYSTEM_PROMPT,
  SQL_REPAIR_SYSTEM_PROMPT,
  SQL_SYSTEM_PROMPT,
} from '../config/prompts.js';
import { queryAll } from '../lib/sql.js';
import { expandGraphNode } from './graph-expansion-service.js';

const conversations = new Map();
const NODE_PRIORITY = ['bill_', 'so_', 'del_', 'je_', 'customer_', 'product_', 'plant_'];
const SQL_TRANSLATION_MODEL = 'llama-3.3-70b-versatile';
const MAX_RESULT_ROWS = 50;
const MAX_SQL_REPAIR_ATTEMPTS = 2;
const MAX_GRAPH_EXPANSIONS = 12;
const MAX_GRAPH_EXPANSION_DEPTH = 2;
const MAX_NEIGHBORS_PER_HIGHLIGHT_SEED = 4;

function isGuardrailReject(text) {
  return text.trim() === 'GUARDRAIL_REJECT';
}

function getConversationHistory(sessionId) {
  if (!conversations.has(sessionId)) {
    conversations.set(sessionId, []);
  }

  return conversations.get(sessionId);
}

function stripMarkdownFences(text, language = '') {
  const languagePattern = language ? `${language}\\n?` : '[a-z]*\\n?';
  return text
    .replace(new RegExp(`^\`\`\`${languagePattern}`, 'i'), '')
    .replace(/```$/i, '')
    .trim();
}

function sanitizeSql(sql) {
  return stripMarkdownFences(sql, 'sql').trim();
}

function parseJsonResponse(rawContent) {
  const sanitized = stripMarkdownFences(rawContent, 'json');

  try {
    return JSON.parse(sanitized);
  } catch {
    const jsonMatch = sanitized.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Model did not return valid JSON');
    }

    return JSON.parse(jsonMatch[0]);
  }
}

function normalizeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizeQueryPlan(rawPlan, question) {
  const plan = rawPlan && typeof rawPlan === 'object' ? rawPlan : {};

  return {
    question,
    guardrail: Boolean(plan.guardrail),
    intent: typeof plan.intent === 'string' ? plan.intent : 'dataset_query',
    responseShape: typeof plan.responseShape === 'string' ? plan.responseShape : 'table',
    primaryEntities: normalizeArray(plan.primaryEntities).map((value) => String(value)),
    referencedIdentifiers: normalizeArray(plan.referencedIdentifiers).map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const type = item.type ? String(item.type) : null;
      const value = item.value ? String(item.value) : null;
      return type && value ? { type, value } : null;
    }).filter(Boolean),
    filters: normalizeArray(plan.filters).map((value) => String(value)),
    relationships: normalizeArray(plan.relationships).map((value) => String(value)),
    metrics: normalizeArray(plan.metrics).map((value) => String(value)),
    reasoning: typeof plan.reasoning === 'string' ? plan.reasoning : '',
  };
}

function createFallbackQueryPlan(question) {
  return {
    question,
    guardrail: false,
    intent: 'dataset_query',
    responseShape: 'table',
    primaryEntities: [],
    referencedIdentifiers: [],
    filters: [],
    relationships: [],
    metrics: [],
    reasoning: 'Fallback plan used because the planner output was not parseable.',
  };
}

function serializeHistoryForPrompt(history) {
  if (history.length === 0) {
    return 'No prior conversation context.';
  }

  return history
    .slice(-4)
    .map((entry, index) => {
      if (entry.role === 'user') {
        return `${index + 1}. User asked: ${entry.question}`;
      }

      const planSummary = entry.plan ? JSON.stringify({
        intent: entry.plan.intent,
        primaryEntities: entry.plan.primaryEntities,
        relationships: entry.plan.relationships,
      }) : 'N/A';

      return `${index + 1}. Assistant used SQL: ${entry.sql || 'N/A'} | plan: ${planSummary}`;
    })
    .join('\n');
}

function addNodeReference(nodeIds, type, value) {
  if (value === null || value === undefined || value === '') {
    return;
  }

  nodeIds.add(`${type}_${String(value)}`);
}

function extractNodeReferencesFromPlan(plan) {
  const nodeIds = new Set();

  for (const identifier of plan.referencedIdentifiers || []) {
    const normalizedType = identifier.type?.toLowerCase();
    if (!normalizedType || !identifier.value) {
      continue;
    }

    if (normalizedType.includes('sales_order') || normalizedType === 'sales_order') {
      addNodeReference(nodeIds, 'so', identifier.value);
    }
    if (normalizedType.includes('delivery')) {
      addNodeReference(nodeIds, 'del', identifier.value);
    }
    if (normalizedType.includes('billing') || normalizedType.includes('invoice')) {
      addNodeReference(nodeIds, 'bill', identifier.value);
    }
    if (normalizedType.includes('journal') || normalizedType.includes('accounting_document')) {
      addNodeReference(nodeIds, 'je', identifier.value);
    }
    if (normalizedType.includes('customer') || normalizedType.includes('business_partner')) {
      addNodeReference(nodeIds, 'customer', identifier.value);
    }
    if (normalizedType.includes('product') || normalizedType.includes('material')) {
      addNodeReference(nodeIds, 'product', identifier.value);
    }
    if (normalizedType.includes('plant')) {
      addNodeReference(nodeIds, 'plant', identifier.value);
    }
  }

  return [...nodeIds];
}

function extractNodeReferencesFromResults(results) {
  const nodeIds = new Set();

  for (const row of results.slice(0, MAX_RESULT_ROWS)) {
    for (const [key, value] of Object.entries(row)) {
      if (!value) {
        continue;
      }

      const normalizedKey = key.toLowerCase();

      if (normalizedKey.includes('sales_order') && !normalizedKey.includes('item')) {
        addNodeReference(nodeIds, 'so', value);
      }
      if (
        (normalizedKey.includes('delivery_document') || normalizedKey === 'delivery' || normalizedKey === 'delivery_number') &&
        !normalizedKey.includes('item')
      ) {
        addNodeReference(nodeIds, 'del', value);
      }
      if (
        (normalizedKey.includes('billing_document') || normalizedKey.includes('invoice')) &&
        !normalizedKey.includes('item')
      ) {
        addNodeReference(nodeIds, 'bill', value);
      }
      if (
        normalizedKey === 'business_partner' ||
        normalizedKey === 'sold_to_party' ||
        normalizedKey === 'customer' ||
        normalizedKey === 'customer_id'
      ) {
        addNodeReference(nodeIds, 'customer', value);
      }
      if (normalizedKey === 'material' || normalizedKey === 'product' || normalizedKey === 'product_id') {
        addNodeReference(nodeIds, 'product', value);
      }
      if (
        normalizedKey === 'accounting_document' ||
        normalizedKey.includes('journal_entry') ||
        normalizedKey.includes('accounting_document_number')
      ) {
        addNodeReference(nodeIds, 'je', value);
      }
      if (normalizedKey === 'reference_document') {
        addNodeReference(nodeIds, 'bill', value);
      }
      if (normalizedKey === 'plant' || normalizedKey === 'plant_id') {
        addNodeReference(nodeIds, 'plant', value);
      }
    }
  }

  return [...nodeIds];
}

function extractNodeReferencesFromSql(sql) {
  const nodeIds = new Set();
  const patterns = [
    { regex: /\b(?:sales_order)\s*=\s*'?([A-Za-z0-9]+)'?/gi, prefix: 'so' },
    { regex: /\b(?:delivery_document)\s*=\s*'?([A-Za-z0-9]+)'?/gi, prefix: 'del' },
    { regex: /\b(?:billing_document|cancelled_billing_document|reference_document)\s*=\s*'?([A-Za-z0-9]+)'?/gi, prefix: 'bill' },
    { regex: /\b(?:accounting_document)\s*=\s*'?([A-Za-z0-9]+)'?/gi, prefix: 'je' },
    { regex: /\b(?:business_partner|sold_to_party|customer)\s*=\s*'?([A-Za-z0-9]+)'?/gi, prefix: 'customer' },
    { regex: /\b(?:material|product)\s*=\s*'?([A-Za-z0-9]+)'?/gi, prefix: 'product' },
    { regex: /\b(?:plant)\s*=\s*'?([A-Za-z0-9]+)'?/gi, prefix: 'plant' },
  ];

  for (const { regex, prefix } of patterns) {
    for (const match of sql.matchAll(regex)) {
      addNodeReference(nodeIds, prefix, match[1]);
    }
  }

  return [...nodeIds];
}

function prioritizeFocusNode(nodeIds) {
  for (const prefix of NODE_PRIORITY) {
    const match = nodeIds.find((nodeId) => nodeId.startsWith(prefix));
    if (match) {
      return match;
    }
  }

  return nodeIds[0] || null;
}

function getNodePriorityIndex(nodeId) {
  const index = NODE_PRIORITY.findIndex((prefix) => nodeId.startsWith(prefix));
  return index === -1 ? NODE_PRIORITY.length : index;
}

function compareNodePriority(left, right) {
  return getNodePriorityIndex(left) - getNodePriorityIndex(right);
}

function createEdgeKey(source, target, label = '') {
  return `${source}->${target}:${label}`;
}

function getNodeTypePrefix(nodeId) {
  return NODE_PRIORITY.find((prefix) => nodeId.startsWith(prefix)) || nodeId.split('_')[0];
}

function mergeGraphPayload(baseGraph, incomingGraph) {
  const nodeMap = new Map(baseGraph.nodes.map((node) => [node.id, node]));
  const edgeMap = new Map(
    baseGraph.edges.map((edge) => [createEdgeKey(edge.source, edge.target, edge.label || ''), edge]),
  );

  for (const node of incomingGraph.nodes) {
    nodeMap.set(node.id, { ...nodeMap.get(node.id), ...node });
  }

  for (const edge of incomingGraph.edges) {
    edgeMap.set(createEdgeKey(edge.source, edge.target, edge.label || ''), edge);
  }

  return {
    nodes: [...nodeMap.values()],
    edges: [...edgeMap.values()],
  };
}

function validateSql(generatedSql) {
  const cleanSql = sanitizeSql(generatedSql).replace(/;+\s*$/g, '').trim();

  if (!cleanSql) {
    throw new Error('The model returned an empty SQL query');
  }

  if (!/^select\b/i.test(cleanSql)) {
    throw new Error('Only SELECT queries are allowed');
  }

  if (/;[\s\S]*\S/.test(cleanSql)) {
    throw new Error('Only a single SELECT statement is allowed');
  }

  if (/\b(insert|update|delete|drop|alter|pragma|attach|detach|create|replace|truncate)\b/i.test(cleanSql)) {
    throw new Error('The generated query contains a forbidden SQL operation');
  }

  return cleanSql;
}

async function generateQueryPlan(client, question, history) {
  const messages = [
    { role: 'system', content: QUERY_PLAN_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Conversation context:\n${serializeHistoryForPrompt(history)}\n\nUser question:\n${question}`,
    },
  ];

  const completion = await client.chat.completions.create({
    messages,
    model: SQL_TRANSLATION_MODEL,
    temperature: 0,
    max_tokens: 700,
  });

  try {
    return normalizeQueryPlan(parseJsonResponse(completion.choices[0].message.content.trim()), question);
  } catch (error) {
    console.warn('Falling back to heuristic query plan:', error.message);
    return createFallbackQueryPlan(question);
  }
}

async function generateSql(client, question, history, queryPlan) {
  const messages = [
    { role: 'system', content: SQL_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Conversation context:\n${serializeHistoryForPrompt(history)}\n\nStructured query plan:\n${JSON.stringify(queryPlan, null, 2)}\n\nUser question:\n${question}`,
    },
  ];

  const completion = await client.chat.completions.create({
    messages,
    model: SQL_TRANSLATION_MODEL,
    temperature: 0,
    max_tokens: 1000,
  });

  return completion.choices[0].message.content.trim();
}

async function repairSql(client, question, queryPlan, failingSql, sqlError) {
  const messages = [
    { role: 'system', content: SQL_REPAIR_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `User question:\n${question}\n\nStructured query plan:\n${JSON.stringify(queryPlan, null, 2)}\n\nFailing SQL:\n${failingSql}\n\nExecution error:\n${sqlError}`,
    },
  ];

  const completion = await client.chat.completions.create({
    messages,
    model: SQL_TRANSLATION_MODEL,
    temperature: 0,
    max_tokens: 1000,
  });

  return completion.choices[0].message.content.trim();
}

async function translateQuestionToSql({ client, question, history, queryPlan }) {
  const sqlAttempts = [];
  let latestSql = await generateSql(client, question, history, queryPlan);
  let latestError = null;

  for (let attempt = 0; attempt <= MAX_SQL_REPAIR_ATTEMPTS; attempt += 1) {
    if (isGuardrailReject(latestSql)) {
      throw new Error(GUARDRAIL_REJECTION_MESSAGE);
    }

    try {
      const cleanSql = validateSql(latestSql);
      return {
        sql: cleanSql,
        sqlAttempts: [...sqlAttempts, cleanSql],
      };
    } catch (error) {
      latestError = error.message;
      sqlAttempts.push(sanitizeSql(latestSql));

      if (attempt === MAX_SQL_REPAIR_ATTEMPTS) {
        throw new Error(latestError);
      }

      latestSql = await repairSql(client, question, queryPlan, latestSql, latestError);
    }
  }

  throw new Error(latestError || 'Failed to generate a valid SQL query');
}

async function executeSqlWithRepair({ db, client, question, queryPlan, sql, sqlAttempts }) {
  let currentSql = sql;
  let latestError = null;
  const attempts = [...sqlAttempts];

  for (let attempt = 0; attempt <= MAX_SQL_REPAIR_ATTEMPTS; attempt += 1) {
    try {
      return {
        sql: currentSql,
        sqlAttempts: attempts,
        queryResult: queryAll(db, currentSql),
      };
    } catch (error) {
      latestError = error.message;
      console.error('SQL Execution Error:', error.message);
      console.error('SQL:', currentSql);

      if (attempt === MAX_SQL_REPAIR_ATTEMPTS) {
        throw new Error(latestError);
      }

      const repairedSql = await repairSql(client, question, queryPlan, currentSql, latestError);
      if (isGuardrailReject(repairedSql)) {
        throw new Error(GUARDRAIL_REJECTION_MESSAGE);
      }
      currentSql = validateSql(repairedSql);
      attempts.push(currentSql);
    }
  }

  throw new Error(latestError || 'Failed to execute SQL query');
}

async function generateAnswer(client, question, sql, queryResult) {
  const responseMessages = [
    { role: 'system', content: RESPONSE_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `User Question: ${question}\n\nSQL Query Executed:\n${sql}\n\nQuery Results (${queryResult.length} rows):\n${JSON.stringify(queryResult.slice(0, 20), null, 2)}${queryResult.length > 20 ? `\n... and ${queryResult.length - 20} more rows` : ''}`,
    },
  ];

  const completion = await client.chat.completions.create({
    messages: responseMessages,
    model: SQL_TRANSLATION_MODEL,
    temperature: 0.3,
    max_tokens: 1500,
  });

  return completion.choices[0].message.content.trim();
}

function buildAdjacency(edges) {
  const adjacency = new Map();

  const addEdgeToAdjacency = (from, to, edge) => {
    if (!adjacency.has(from)) {
      adjacency.set(from, []);
    }

    adjacency.get(from).push({ nodeId: to, edge });
  };

  for (const edge of edges) {
    addEdgeToAdjacency(edge.source, edge.target, edge);
    addEdgeToAdjacency(edge.target, edge.source, edge);
  }

  return adjacency;
}

function collectImmediateNeighborhood(graphContext, seedNodeIds, neighborLimit = MAX_NEIGHBORS_PER_HIGHLIGHT_SEED) {
  const adjacency = buildAdjacency(graphContext.edges);
  const nodeIds = new Set(seedNodeIds);
  const edgeIds = new Set();

  for (const seedNodeId of seedNodeIds) {
    const neighbors = (adjacency.get(seedNodeId) || [])
      .sort((left, right) => compareNodePriority(left.nodeId, right.nodeId))
      .slice(0, neighborLimit);

    for (const neighbor of neighbors) {
      nodeIds.add(neighbor.nodeId);
      edgeIds.add(createEdgeKey(neighbor.edge.source, neighbor.edge.target, neighbor.edge.label || ''));
    }
  }

  return {
    nodeIds: [...nodeIds].sort(compareNodePriority),
    edgeIds: [...edgeIds],
  };
}

function findShortestPath(adjacency, startNodeId, targetNodeId) {
  if (startNodeId === targetNodeId) {
    return { nodes: [startNodeId], edges: [] };
  }

  const queue = [{ nodeId: startNodeId, nodes: [startNodeId], edges: [] }];
  const visited = new Set([startNodeId]);

  while (queue.length > 0) {
    const current = queue.shift();
    const neighbors = adjacency.get(current.nodeId) || [];

    for (const neighbor of neighbors) {
      if (visited.has(neighbor.nodeId)) {
        continue;
      }

      const nextNodes = [...current.nodes, neighbor.nodeId];
      const nextEdges = [...current.edges, neighbor.edge];

      if (neighbor.nodeId === targetNodeId) {
        return {
          nodes: nextNodes,
          edges: nextEdges,
        };
      }

      visited.add(neighbor.nodeId);
      queue.push({
        nodeId: neighbor.nodeId,
        nodes: nextNodes,
        edges: nextEdges,
      });
    }
  }

  return null;
}

function buildHighlightGraphContext(db, seedNodeIds) {
  const uniqueSeedNodeIds = [...new Set(seedNodeIds)].filter(Boolean).sort(compareNodePriority);
  const queuedNodeIds = new Set(uniqueSeedNodeIds);
  const expandedNodeIds = new Set();
  const queue = uniqueSeedNodeIds.map((nodeId) => ({ nodeId, depth: 0 }));
  let graphContext = { nodes: [], edges: [] };

  while (queue.length > 0 && expandedNodeIds.size < MAX_GRAPH_EXPANSIONS) {
    const { nodeId, depth } = queue.shift();
    if (expandedNodeIds.has(nodeId)) {
      continue;
    }

    try {
      const expandedGraph = expandGraphNode(db, nodeId);
      graphContext = mergeGraphPayload(graphContext, expandedGraph);
      expandedNodeIds.add(nodeId);

      if (depth >= MAX_GRAPH_EXPANSION_DEPTH) {
        continue;
      }

      const neighborNodeIds = expandedGraph.nodes
        .map((node) => node.id)
        .filter((candidateId) => candidateId !== nodeId)
        .sort(compareNodePriority);

      for (const neighborNodeId of neighborNodeIds) {
        if (queuedNodeIds.has(neighborNodeId)) {
          continue;
        }

        queuedNodeIds.add(neighborNodeId);
        queue.push({
          nodeId: neighborNodeId,
          depth: depth + 1,
        });
      }
    } catch (error) {
      console.warn(`Could not expand node ${nodeId}:`, error.message);
    }
  }

  return graphContext;
}

function deriveHighlightPayload(db, referencedNodeIds) {
  const uniqueNodeIds = [...new Set(referencedNodeIds)].filter(Boolean);
  if (uniqueNodeIds.length === 0) {
    return {
      highlightNodes: [],
      highlightEdges: [],
      focusNodeId: null,
    };
  }

  const graphContext = buildHighlightGraphContext(db, uniqueNodeIds);
  const availableNodeIds = new Set(graphContext.nodes.map((node) => node.id));
  const connectedSeedNodeIds = uniqueNodeIds.filter((nodeId) => availableNodeIds.has(nodeId));
  const focusNodeId = prioritizeFocusNode(connectedSeedNodeIds.length > 0 ? connectedSeedNodeIds : uniqueNodeIds);
  const distinctSeedTypes = new Set(uniqueNodeIds.map((nodeId) => getNodeTypePrefix(nodeId)));
  const shouldPreferLocalNeighborhood = distinctSeedTypes.size === 1 && uniqueNodeIds.length > 1;

  if (!focusNodeId) {
    return {
      highlightNodes: uniqueNodeIds,
      highlightEdges: [],
      focusNodeId: null,
    };
  }

  const adjacency = buildAdjacency(graphContext.edges);
  const highlightNodeSet = new Set([focusNodeId]);
  const highlightEdgeSet = new Set();

  if (shouldPreferLocalNeighborhood) {
    const localNeighborhood = collectImmediateNeighborhood(
      graphContext,
      connectedSeedNodeIds.length > 0 ? connectedSeedNodeIds : [focusNodeId],
    );

    for (const nodeId of localNeighborhood.nodeIds) {
      highlightNodeSet.add(nodeId);
    }

    for (const edgeId of localNeighborhood.edgeIds) {
      highlightEdgeSet.add(edgeId);
    }
  } else {
    for (const targetNodeId of connectedSeedNodeIds) {
      const path = findShortestPath(adjacency, focusNodeId, targetNodeId);
      if (!path) {
        highlightNodeSet.add(targetNodeId);
        continue;
      }

      for (const nodeId of path.nodes) {
        highlightNodeSet.add(nodeId);
      }

      for (const edge of path.edges) {
        highlightEdgeSet.add(createEdgeKey(edge.source, edge.target, edge.label || ''));
      }
    }
  }

  const focusNeighborhood = collectImmediateNeighborhood(graphContext, [focusNodeId], 3);
  for (const nodeId of focusNeighborhood.nodeIds) {
    highlightNodeSet.add(nodeId);
  }
  for (const edgeId of focusNeighborhood.edgeIds) {
    highlightEdgeSet.add(edgeId);
  }

  for (const nodeId of uniqueNodeIds) {
    highlightNodeSet.add(nodeId);
  }

  return {
    highlightNodes: [...highlightNodeSet].sort(compareNodePriority),
    highlightEdges: [...highlightEdgeSet],
    focusNodeId,
  };
}

export async function processQuery({ db, client, question, sessionId = 'default' }) {
  const history = getConversationHistory(sessionId);
  const queryPlan = await generateQueryPlan(client, question, history);

  if (queryPlan.guardrail) {
    history.push({ role: 'user', question });
    history.push({ role: 'assistant', response: GUARDRAIL_REJECTION_MESSAGE, sql: null, plan: queryPlan });

    return {
      answer: GUARDRAIL_REJECTION_MESSAGE,
      sql: null,
      result: [],
      guardrailTriggered: true,
      queryPlan,
      highlightNodes: [],
      highlightEdges: [],
      focusNodeId: null,
    };
  }

  let finalSql = null;
  let queryResult = [];
  let sqlAttempts = [];
  let sqlError = null;

  try {
    const translationResult = await translateQuestionToSql({
      client,
      question,
      history,
      queryPlan,
    });

    const executionResult = await executeSqlWithRepair({
      db,
      client,
      question,
      queryPlan,
      sql: translationResult.sql,
      sqlAttempts: translationResult.sqlAttempts,
    });

    finalSql = executionResult.sql;
    sqlAttempts = executionResult.sqlAttempts;
    queryResult = executionResult.queryResult;
  } catch (error) {
    sqlError = error.message;
  }

  const answer = sqlError
    ? `I encountered an issue translating that question into a valid dataset query. ${sqlError}. Please try rephrasing the request with the business entity or document ID you want to inspect.`
    : await generateAnswer(client, question, finalSql, queryResult);

  const highlightPayload = deriveHighlightPayload(db, [
    ...extractNodeReferencesFromPlan(queryPlan),
    ...extractNodeReferencesFromSql(finalSql || ''),
    ...extractNodeReferencesFromResults(queryResult),
  ]);

  history.push({ role: 'user', question });
  history.push({ role: 'assistant', response: answer, sql: finalSql, plan: queryPlan });
  if (history.length > 20) {
    conversations.set(sessionId, history.slice(-20));
  }

  return {
    answer,
    sql: finalSql,
    result: queryResult.slice(0, MAX_RESULT_ROWS),
    totalRows: queryResult.length,
    highlightNodes: highlightPayload.highlightNodes,
    highlightEdges: highlightPayload.highlightEdges,
    focusNodeId: highlightPayload.focusNodeId,
    sqlError,
    sqlAttempts,
    queryPlan,
  };
}
