import { Router } from 'express';
import { createGroqClient } from '../config/llm.js';
import { ensureDb } from '../lib/db-instance.js';
import { processQuery } from '../services/query-service.js';

const router = Router();
const groqClient = createGroqClient();

router.post('/query', async (req, res) => {
  const { question, sessionId = 'default' } = req.body;

  if (!question) {
    return res.status(400).json({ error: 'Question is required' });
  }

  try {
    const db = await ensureDb();
    const result = await processQuery({
      db,
      client: groqClient,
      question,
      sessionId,
    });

    res.json(result);
  } catch (error) {
    console.error('Query error:', error);
    res.status(500).json({
      error: 'Failed to process query',
      details: error.message,
    });
  }
});

export default router;
