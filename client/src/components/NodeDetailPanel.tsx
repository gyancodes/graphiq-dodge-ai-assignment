import { Maximize2, X } from 'lucide-react';
import { NODE_COLORS, NODE_LABELS } from '../constants/graph';
import type { NodeDetailResponse, ResultRow } from '../types/app';

interface NodeDetailPanelProps {
  nodeDetail: NodeDetailResponse;
  selectedNode: string | null;
  expandingNodeId: string | null;
  onClose: () => void;
  onExpandNode: (nodeId: string) => void;
}

function renderObjectFields(data: ResultRow) {
  const entries = Object.entries(data).filter(([, value]) => value !== null && value !== '' && value !== undefined);

  if (entries.length === 0) {
    return <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>No data</div>;
  }

  return entries.slice(0, 12).map(([key, value]) => (
    <div key={key} className="detail-row">
      <span className="detail-label">{key.replace(/_/g, ' ')}</span>
      <span className="detail-value">{String(value)}</span>
    </div>
  ));
}

export function NodeDetailPanel({
  nodeDetail,
  selectedNode,
  expandingNodeId,
  onClose,
  onExpandNode,
}: NodeDetailPanelProps) {
  const color = NODE_COLORS[nodeDetail.type] || '#666';
  const isExpanding = expandingNodeId === nodeDetail.nodeId;
  const data = nodeDetail.data;

  return (
    <div className="node-detail-panel">
      <div className="node-detail-header">
        <h3>
          <span className="node-type-badge" style={{ background: `${color}20`, color }}>
            {NODE_LABELS[nodeDetail.type] || nodeDetail.type}
          </span>
          {nodeDetail.nodeId.split('_').slice(1).join('_')}
        </h3>
        <button className="close-btn" onClick={onClose}>
          <X size={14} />
        </button>
      </div>

      <div className="node-detail-body">
        <div className="node-detail-actions">
          <button
            className="detail-action-btn"
            onClick={() => onExpandNode(nodeDetail.nodeId)}
            disabled={isExpanding}
          >
            <Maximize2 size={12} />
            {isExpanding
              ? 'Expanding connections...'
              : selectedNode === nodeDetail.nodeId
                ? 'Expand connections'
                : 'Expand node'}
          </button>
        </div>

        <div className="detail-section">
          <div className="detail-section-title">Properties</div>
          {Array.isArray(data)
            ? data.slice(0, 5).map((item, index) => (
                <div key={index} style={{ marginBottom: 8 }}>
                  {renderObjectFields(item)}
                </div>
              ))
            : data
              ? renderObjectFields(data)
              : <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>No data</div>}
        </div>

        {nodeDetail.related.map((relation) => (
          relation.data.length > 0 && (
            <div key={relation.type} className="detail-section">
              <div className="detail-section-title">
                {relation.type.replace(/_/g, ' ')} ({relation.data.length})
              </div>
              {relation.data.slice(0, 3).map((item, index) => (
                <div
                  key={index}
                  style={{ marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--border-subtle)' }}
                >
                  {renderObjectFields(item)}
                </div>
              ))}
              {relation.data.length > 3 && (
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', padding: '4px 0' }}>
                  + {relation.data.length - 3} more
                </div>
              )}
            </div>
          )
        ))}
      </div>
    </div>
  );
}
