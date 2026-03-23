export function createGraphAccumulator() {
  const nodes = [];
  const edges = [];
  const nodeSet = new Set();
  const edgeSet = new Set();

  const addNode = (id, label, type, metadata = {}) => {
    if (!id || !label || !type || nodeSet.has(id)) {
      return;
    }

    nodeSet.add(id);
    nodes.push({ id, label, type, ...metadata });
  };

  const addEdge = (source, target, label = '') => {
    if (!source || !target) {
      return;
    }

    const edgeKey = `${source}->${target}:${label}`;
    if (edgeSet.has(edgeKey)) {
      return;
    }

    edgeSet.add(edgeKey);
    edges.push({ source, target, label });
  };

  return {
    addNode,
    addEdge,
    getGraph() {
      return {
        nodes,
        edges: edges.filter((edge) => nodeSet.has(edge.source) && nodeSet.has(edge.target)),
      };
    },
  };
}
