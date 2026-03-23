export interface GraphNode {
  id: string;
  label: string;
  type: string;
  [key: string]: any;
}

export interface GraphEdge {
  source: string;
  target: string;
  label?: string;
}

export interface GraphPayload {
  nodes: GraphNode[];
  edges: GraphEdge[];
  expandedFrom?: string;
}

export interface ResultRow {
  [key: string]: unknown;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  sql?: string | null;
  result?: ResultRow[];
  totalRows?: number;
  highlightNodes?: string[];
  highlightEdges?: string[];
  focusNodeId?: string | null;
  guardrailTriggered?: boolean;
  timestamp: string;
}

export interface Stats {
  customers: number;
  salesOrders: number;
  deliveries: number;
  billingDocs: number;
  journalEntries?: number;
  payments?: number;
  products: number;
  plants: number;
  totalOrderValue: number;
  totalBilledValue: number;
}

export interface NodeDetailRelation {
  type: string;
  data: ResultRow[];
}

export interface NodeDetailResponse {
  nodeId: string;
  type: string;
  data: ResultRow | ResultRow[] | null;
  related: NodeDetailRelation[];
}

export interface QueryResponse {
  answer: string;
  sql: string | null;
  result: ResultRow[];
  totalRows?: number;
  highlightNodes?: string[];
  highlightEdges?: string[];
  focusNodeId?: string | null;
  guardrailTriggered?: boolean;
  sqlError?: string | null;
  sqlAttempts?: string[];
  queryPlan?: Record<string, unknown>;
}
