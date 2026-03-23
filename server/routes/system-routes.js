import { Router } from 'express';
import { SUGGESTED_QUERIES } from '../constants/suggestions.js';
import { ensureDb } from '../lib/db-instance.js';
import { getHealthSummary, getStats } from '../services/system-service.js';

const router = Router();

router.get('/health', async (_req, res) => {
  try {
    const db = await ensureDb();
    res.json(getHealthSummary(db));
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

router.get('/stats', async (_req, res) => {
  try {
    const db = await ensureDb();
    res.json(getStats(db));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/suggestions', (_req, res) => {
  res.json({ suggestions: SUGGESTED_QUERIES });
});

export default router;
