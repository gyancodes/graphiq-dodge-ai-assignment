import CytoscapeComponent from 'react-cytoscapejs';
import cytoscape from 'cytoscape';
import { RotateCcw, X } from 'lucide-react';
import { NODE_COLORS, NODE_LABELS, cytoscapeStylesheet } from '../constants/graph';
import type { NodeDetailResponse } from '../types/app';
import { NodeDetailPanel } from './NodeDetailPanel';

interface GraphPanelProps {
  elements: cytoscape.ElementDefinition[];
  graphError: string | null;
  highlightedNodes: Set<string>;
  selectedNode: string | null;
  expandingNodeId: string | null;
  nodeDetail: NodeDetailResponse | null;
  onResetGraph: () => void;
  onClearHighlights: () => void;
  onNodeClick: (nodeId: string) => void;
  onCanvasClick: () => void;
  onCloseNodeDetail: () => void;
  onExpandNode: (nodeId: string) => void;
  onCyReady: (cy: cytoscape.Core) => void;
}

export function GraphPanel({
  elements,
  graphError,
  highlightedNodes,
  selectedNode,
  expandingNodeId,
  nodeDetail,
  onResetGraph,
  onClearHighlights,
  onNodeClick,
  onCanvasClick,
  onCloseNodeDetail,
  onExpandNode,
  onCyReady,
}: GraphPanelProps) {
  return (
    <div className="graph-panel">
      <div className="graph-controls">
        <button className="ctrl-btn" onClick={onResetGraph}>
          <RotateCcw size={13} /> Reset
        </button>
        {highlightedNodes.size > 0 && (
          <button className="ctrl-btn active" onClick={onClearHighlights}>
            <X size={13} /> Clear Highlights ({highlightedNodes.size})
          </button>
        )}
      </div>

      {elements.length > 0 ? (
        <CytoscapeComponent
          className="graph-canvas"
          elements={elements}
          stylesheet={cytoscapeStylesheet as any}
          layout={{
            name: 'breadthfirst',
            directed: true,
            circle: false,
            padding: 48,
            spacingFactor: 1.2,
            animate: false,
            avoidOverlap: true,
            nodeDimensionsIncludeLabels: true,
          } as any}
          style={{ width: '100%', height: '100%' }}
          cy={(cy: cytoscape.Core) => {
            onCyReady(cy);
            cy.on('tap', 'node', (event: cytoscape.EventObject) => {
              onNodeClick(event.target.id());
            });
            cy.on('tap', (event: cytoscape.EventObject) => {
              if (event.target === cy) {
                onCanvasClick();
              }
            });
          }}
          maxZoom={4}
          minZoom={0.2}
        />
      ) : (
        <div className="graph-empty-state">
          <h3>{graphError ? 'Graph failed to load' : 'Graph is loading'}</h3>
          <p>
            {graphError || 'Waiting for graph data from the API.'}
          </p>
        </div>
      )}

      <div className="graph-legend">
        {Object.entries(NODE_LABELS).map(([type, label]) => (
          <div key={type} className="legend-item">
            <div className="legend-dot" style={{ background: NODE_COLORS[type] }} />
            {label}
          </div>
        ))}
      </div>

      {nodeDetail && (
        <NodeDetailPanel
          nodeDetail={nodeDetail}
          selectedNode={selectedNode}
          expandingNodeId={expandingNodeId}
          onClose={onCloseNodeDetail}
          onExpandNode={onExpandNode}
        />
      )}
    </div>
  );
}
