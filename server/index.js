import 'dotenv/config';
import { createApp } from './app.js';

const app = createApp();
const port = process.env.PORT || 3001;

app.listen(port, () => {
  console.log(`\nGraphIQ Server running on http://localhost:${port}`);
  console.log(`Health: http://localhost:${port}/health`);
  console.log(`Graph:  http://localhost:${port}/graph`);
  console.log(`Query:  POST http://localhost:${port}/query`);
});
