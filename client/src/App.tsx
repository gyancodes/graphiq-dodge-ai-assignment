import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import { AppHeader } from './components/AppHeader';
import { ChatPanel } from './components/ChatPanel';
import { GraphPanel } from './components/GraphPanel';
import {
  expandGraphNode,
  fetchGraphData,
  fetchNodeDetailData,
  fetchStatsData,
  fetchSuggestionsData,
  submitQuery,
} from './services/api';
import type { GraphPayload, Message, NodeDetailResponse, Stats } from './types/app';
import { buildCytoscapeElements, mergeGraphData } from './utils/graph';

const WELCOME_MESSAGE: Message = {
  role: 'assistant',
  content: "Welcome to **GraphIQ**! I'm your AI analyst for SAP Order-to-Cash data. I can help you explore sales orders, deliveries, billing documents, payments, and more.\n\nTry asking me something like:\n- *Which products have the most billing documents?*\n- *Trace the flow of sales order 740506*\n- *Find orders that were delivered but not billed*",
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
};

function App() {
  const [graphData, setGraphData] = useState<GraphPayload>({ nodes: [], edges: [] });
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [nodeDetail, setNodeDetail] = useState<NodeDetailResponse | null>(null);
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
  const [highlightedEdges, setHighlightedEdges] = useState<Set<string>>(new Set());
  const [expandingNodeId, setExpandingNodeId] = useState<string | null>(null);

  const cyRef = useRef<cytoscape.Core | null>(null);
  const sessionId = useRef(`session_${Date.now()}`);

  const loadInitialData = useCallback(async () => {
    const [graphResult, statsResult, suggestionsResult] = await Promise.allSettled([
      fetchGraphData(),
      fetchStatsData(),
      fetchSuggestionsData(),
    ]);

    if (graphResult.status === 'fulfilled') {
      setGraphData(graphResult.value);
      setGraphError(null);
    } else {
      console.error('Graph fetch error:', graphResult.reason);
      setGraphError('The frontend could not reach the graph API. Check VITE_API_URL for the deployed frontend.');
    }

    if (statsResult.status === 'fulfilled') {
      setStats(statsResult.value);
    } else {
      console.error('Stats fetch error:', statsResult.reason);
    }

    if (suggestionsResult.status === 'fulfilled') {
      setSuggestions(suggestionsResult.value);
    } else {
      console.error('Suggestions fetch error:', suggestionsResult.reason);
    }
  }, []);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.elements().removeClass('highlighted dimmed');

    if (highlightedNodes.size === 0 && highlightedEdges.size === 0) {
      return;
    }

    cy.nodes().forEach((node) => {
      if (highlightedNodes.has(node.id())) {
        node.addClass('highlighted');
      } else {
        node.addClass('dimmed');
      }
    });

    cy.edges().forEach((edge) => {
      const sourceHighlighted = highlightedNodes.has(edge.source().id());
      const targetHighlighted = highlightedNodes.has(edge.target().id());
      const edgeHighlighted = highlightedEdges.has(edge.id());

      if (edgeHighlighted || (highlightedEdges.size === 0 && sourceHighlighted && targetHighlighted)) {
        edge.addClass('highlighted');
      } else {
        edge.addClass('dimmed');
      }
    });
  }, [highlightedEdges, highlightedNodes]);

  const prioritizeFocusNode = useCallback((nodeIds: string[]) => {
    const priorities = ['bill_', 'so_', 'del_', 'je_', 'customer_', 'product_', 'plant_'];

    for (const prefix of priorities) {
      const match = nodeIds.find((nodeId) => nodeId.startsWith(prefix));
      if (match) {
        return match;
      }
    }

    return nodeIds[0];
  }, []);

  const runGraphLayout = useCallback((focusNodeId?: string) => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.layout({
      name: 'breadthfirst',
      directed: true,
      circle: false,
      animate: 'end',
      animationDuration: 350,
      padding: 48,
      spacingFactor: 1.2,
      avoidOverlap: true,
      nodeDimensionsIncludeLabels: true,
    } as any).run();

    if (!focusNodeId) {
      return;
    }

    setTimeout(() => {
      const focusNode = cy.getElementById(focusNodeId);
      const focusElements = focusNode.length > 0 ? focusNode.closedNeighborhood() : cy.elements();
      cy.animate({
        fit: {
          eles: focusElements,
          padding: 52,
        },
        duration: 300,
      });
    }, 380);
  }, []);

  const extractNodeIdsFromEdgeKeys = useCallback((edgeKeys: string[]) => {
    const nodeIds = new Set<string>();

    for (const edgeKey of edgeKeys) {
      const [pathPart] = edgeKey.split(':');
      const [source, target] = pathPart.split('->');
      if (source) {
        nodeIds.add(source);
      }
      if (target) {
        nodeIds.add(target);
      }
    }

    return [...nodeIds];
  }, []);

  const ensureGraphContextForHighlights = useCallback(async (
    nodeIds: string[],
    edgeIds: string[] = [],
    focusNodeId?: string | null,
  ) => {
    const uniqueNodeIds = [...new Set([
      ...nodeIds,
      ...extractNodeIdsFromEdgeKeys(edgeIds),
    ])].filter(Boolean);

    if (uniqueNodeIds.length === 0) {
      setHighlightedNodes(new Set());
      setHighlightedEdges(new Set());
      return;
    }

    const nodesToExpand = uniqueNodeIds.slice(0, 6);
    setExpandingNodeId(nodesToExpand[0] || null);

    try {
      const expansionResults = await Promise.allSettled(nodesToExpand.map((nodeId) => expandGraphNode(nodeId)));

      setGraphData((currentGraph) => {
        let nextGraph = currentGraph;

        for (const result of expansionResults) {
          if (result.status === 'fulfilled') {
            nextGraph = mergeGraphData(nextGraph, result.value);
          }
        }

        return nextGraph;
      });

      setHighlightedNodes(new Set(uniqueNodeIds));
      setHighlightedEdges(new Set(edgeIds));
      setTimeout(() => runGraphLayout(focusNodeId || prioritizeFocusNode(uniqueNodeIds)), 80);
    } catch (error) {
      console.error('Highlight expansion error:', error);
      setHighlightedNodes(new Set(uniqueNodeIds));
      setHighlightedEdges(new Set(edgeIds));
    } finally {
      setExpandingNodeId(null);
    }
  }, [extractNodeIdsFromEdgeKeys, prioritizeFocusNode, runGraphLayout]);

  const handleSend = useCallback(async (messageText?: string) => {
    const text = messageText || input;
    if (!text.trim() || loading) {
      return;
    }

    const userMessage: Message = {
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((previousMessages) => [...previousMessages, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await submitQuery(text.trim(), sessionId.current);

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.answer,
        sql: response.sql,
        result: response.result,
        totalRows: response.totalRows,
        highlightNodes: response.highlightNodes,
        highlightEdges: response.highlightEdges,
        focusNodeId: response.focusNodeId,
        guardrailTriggered: response.guardrailTriggered,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((previousMessages) => [...previousMessages, assistantMessage]);

      if ((response.highlightNodes && response.highlightNodes.length > 0) || (response.highlightEdges && response.highlightEdges.length > 0)) {
        await ensureGraphContextForHighlights(
          response.highlightNodes || [],
          response.highlightEdges || [],
          response.focusNodeId,
        );
      } else {
        setHighlightedNodes(new Set());
        setHighlightedEdges(new Set());
      }
    } catch (error: any) {
      setMessages((previousMessages) => [
        ...previousMessages,
        {
          role: 'assistant',
          content: error.response?.data?.error || 'An error occurred while processing your request. Please try again.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [ensureGraphContextForHighlights, input, loading]);

  const handleNodeClick = useCallback(async (nodeId: string) => {
    setSelectedNode(nodeId);

    try {
      const detail = await fetchNodeDetailData(nodeId);
      setNodeDetail(detail);
    } catch (error) {
      console.error('Node detail error:', error);
    }
  }, []);

  const handleExpandNode = useCallback(async (nodeId: string) => {
    if (expandingNodeId) {
      return;
    }

    setExpandingNodeId(nodeId);

    try {
      const expandedGraph = await expandGraphNode(nodeId);
      setGraphData((currentGraph) => mergeGraphData(currentGraph, expandedGraph));
      setHighlightedNodes(new Set([nodeId, ...expandedGraph.nodes.map((node) => node.id)]));
      setHighlightedEdges(new Set());
      setTimeout(() => runGraphLayout(nodeId), 50);
    } catch (error) {
      console.error('Graph expansion error:', error);
    } finally {
      setExpandingNodeId(null);
    }
  }, [expandingNodeId, runGraphLayout]);

  const handleCloseNodeDetail = useCallback(() => {
    setSelectedNode(null);
    setNodeDetail(null);
  }, []);

  const handleResetGraph = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }

    cy.fit(undefined, 40);
    setHighlightedNodes(new Set());
    setHighlightedEdges(new Set());
  }, []);

  const cytoscapeElements = useMemo(() => buildCytoscapeElements(graphData), [graphData]);

  return (
    <div id="root">
      <AppHeader stats={stats} />

      <div className="app-container">
        <GraphPanel
          elements={cytoscapeElements}
          graphError={graphError}
          highlightedNodes={highlightedNodes}
          selectedNode={selectedNode}
          expandingNodeId={expandingNodeId}
          nodeDetail={nodeDetail}
          onResetGraph={handleResetGraph}
          onClearHighlights={() => {
            setHighlightedNodes(new Set());
            setHighlightedEdges(new Set());
          }}
          onNodeClick={handleNodeClick}
          onCanvasClick={handleCloseNodeDetail}
          onCloseNodeDetail={handleCloseNodeDetail}
          onExpandNode={handleExpandNode}
          onCyReady={(cy) => {
            cyRef.current = cy;
          }}
        />

        <ChatPanel
          messages={messages}
          suggestions={suggestions}
          input={input}
          loading={loading}
          onInputChange={setInput}
          onSend={handleSend}
        />
      </div>
    </div>
  );
}

export default App;
