import cytoscape from 'cytoscape';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const NODE_COLORS: Record<string, string> = {
  customer: '#818cf8',
  sales_order: '#60a5fa',
  delivery: '#34d399',
  billing: '#fbbf24',
  journal_entry: '#a78bfa',
  product: '#fb7185',
  plant: '#22d3ee',
};

export const NODE_LABELS: Record<string, string> = {
  customer: 'Customer',
  sales_order: 'Sales Order',
  delivery: 'Delivery',
  billing: 'Billing',
  journal_entry: 'Journal Entry',
  product: 'Product',
  plant: 'Plant',
};

export const cytoscapeStylesheet: cytoscape.StylesheetStyle[] = [
  {
    selector: 'node',
    style: {
      'background-color': 'data(color)',
      'label': 'data(shortLabel)',
      'font-size': '9px',
      'font-family': 'Inter, sans-serif',
      'font-weight': 500,
      'color': '#e0e0f0',
      'text-valign': 'bottom',
      'text-halign': 'center',
      'text-margin-y': 6,
      'text-outline-width': 2,
      'text-outline-color': '#0a0a0f',
      'width': 24,
      'height': 24,
      'border-width': 2,
      'border-color': 'data(color)',
      'border-opacity': 0.3,
      'overlay-opacity': 0,
      'transition-property': 'width, height, border-width, border-opacity',
      'transition-duration': 200,
    } as any,
  },
  {
    selector: 'node:selected',
    style: {
      'border-width': 3,
      'border-opacity': 1,
      'width': 32,
      'height': 32,
    } as any,
  },
  {
    selector: 'node.highlighted',
    style: {
      'border-width': 4,
      'border-color': '#ffffff',
      'border-opacity': 1,
      'width': 34,
      'height': 34,
      'underlay-color': '#818cf8',
      'underlay-opacity': 0.3,
      'underlay-padding': 6,
    } as any,
  },
  {
    selector: 'node.dimmed',
    style: {
      'opacity': 0.15,
    } as any,
  },
  {
    selector: 'edge',
    style: {
      'width': 1,
      'line-color': 'rgba(255, 255, 255, 0.08)',
      'target-arrow-color': 'rgba(255, 255, 255, 0.08)',
      'target-arrow-shape': 'triangle',
      'arrow-scale': 0.6,
      'curve-style': 'bezier',
      'label': '',
      'overlay-opacity': 0,
      'transition-property': 'line-color, target-arrow-color, width, opacity',
      'transition-duration': 200,
    } as any,
  },
  {
    selector: 'edge.highlighted',
    style: {
      'line-color': 'rgba(96, 165, 250, 0.95)',
      'target-arrow-color': 'rgba(96, 165, 250, 0.95)',
      'width': 4,
      'arrow-scale': 0.9,
      'label': 'data(label)',
      'font-size': '9px',
      'font-family': 'Inter, sans-serif',
      'font-weight': 600,
      'color': '#dbeafe',
      'text-background-color': 'rgba(15, 23, 42, 0.88)',
      'text-background-opacity': 1,
      'text-background-padding': 3,
      'text-border-color': 'rgba(96, 165, 250, 0.32)',
      'text-border-opacity': 1,
      'text-border-width': 1,
      'text-rotation': 'autorotate',
      'text-margin-y': -6,
    } as any,
  },
  {
    selector: 'edge.dimmed',
    style: {
      'opacity': 0.05,
    } as any,
  },
];
