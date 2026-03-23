import cytoscape from 'cytoscape';
import { NODE_COLORS } from '../constants/graph';
import type { GraphEdge, GraphNode, GraphPayload } from '../types/app';

function createEdgeKey(edge: GraphEdge) {
  return `${edge.source}->${edge.target}:${edge.label || ''}`;
}

export function mergeGraphData(current: GraphPayload, incoming: GraphPayload): GraphPayload {
  const nodeMap = new Map<string, GraphNode>();
  const edgeMap = new Map<string, GraphEdge>();

  for (const node of current.nodes) {
    nodeMap.set(node.id, node);
  }
  for (const node of incoming.nodes) {
    nodeMap.set(node.id, { ...nodeMap.get(node.id), ...node });
  }

  for (const edge of current.edges) {
    edgeMap.set(createEdgeKey(edge), edge);
  }
  for (const edge of incoming.edges) {
    edgeMap.set(createEdgeKey(edge), edge);
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges: Array.from(edgeMap.values()),
  };
}

export function buildCytoscapeElements(graphData: GraphPayload): cytoscape.ElementDefinition[] {
  const elements: cytoscape.ElementDefinition[] = [];

  for (const node of graphData.nodes) {
    const shortLabel = node.label.length > 18 ? `${node.label.slice(0, 16)}...` : node.label;
    elements.push({
      data: {
        ...node,
        id: node.id,
        label: node.label,
        shortLabel,
        color: NODE_COLORS[node.type] || '#666',
        type: node.type,
      },
    });
  }

  for (const edge of graphData.edges) {
    elements.push({
      data: {
        id: createEdgeKey(edge),
        source: edge.source,
        target: edge.target,
        label: edge.label || '',
      },
    });
  }

  return elements;
}
