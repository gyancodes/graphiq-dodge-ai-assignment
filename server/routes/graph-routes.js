import { Router } from 'express';
import { ensureDb } from '../lib/db-instance.js';
import { expandGraphNode } from '../services/graph-expansion-service.js';
import { getNodeDetail } from '../services/node-detail-service.js';
import { getInitialGraph } from '../services/graph-overview-service.js';

const router = Router();

router.get('/graph', async (_req, res) => {
  try {
    const db = await ensureDb();
    res.json(getInitialGraph(db));
  } catch (error) {
    console.error('Graph error:', error);
    res.status(500).json({ error: 'Failed to build graph', details: error.message });
  }
});

router.get('/graph/expand/:nodeId', async (req, res) => {
  try {
    const db = await ensureDb();
    res.json(expandGraphNode(db, req.params.nodeId));
  } catch (error) {
    console.error('Graph expansion error:', error);

    if (error.message.startsWith('Unsupported node type:')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Failed to expand graph node', details: error.message });
  }
});

router.get('/node/:nodeId', async (req, res) => {
  try {
    const db = await ensureDb();
    res.json(getNodeDetail(db, req.params.nodeId));
  } catch (error) {
    if (error.message.startsWith('Unsupported node type:')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: error.message });
  }
});

export default router;
