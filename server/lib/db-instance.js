import { getDb } from '../db.js';

let dbInstance = null;

export async function ensureDb() {
  if (!dbInstance) {
    dbInstance = await getDb();
  }

  return dbInstance;
}
