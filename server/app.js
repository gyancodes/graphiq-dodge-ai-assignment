import cors from 'cors';
import express from 'express';
import graphRoutes from './routes/graph-routes.js';
import queryRoutes from './routes/query-routes.js';
import systemRoutes from './routes/system-routes.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use(systemRoutes);
  app.use(graphRoutes);
  app.use(queryRoutes);

  return app;
}
