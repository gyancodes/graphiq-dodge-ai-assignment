import { queryAll, queryOne } from '../lib/sql.js';

export function getHealthSummary(db) {
  const tables = queryAll(db, "SELECT name FROM sqlite_master WHERE type='table'");
  const counts = {};

  for (const table of tables) {
    const result = queryOne(db, `SELECT COUNT(*) as c FROM ${table.name}`);
    counts[table.name] = result ? result.c : 0;
  }

  return { status: 'ok', tables: counts };
}

export function getStats(db) {
  return {
    customers: queryOne(db, 'SELECT COUNT(*) as c FROM business_partners')?.c || 0,
    salesOrders: queryOne(db, 'SELECT COUNT(*) as c FROM sales_order_headers')?.c || 0,
    deliveries: queryOne(db, 'SELECT COUNT(*) as c FROM outbound_delivery_headers')?.c || 0,
    billingDocs: queryOne(db, 'SELECT COUNT(*) as c FROM billing_document_headers')?.c || 0,
    journalEntries: queryOne(db, 'SELECT COUNT(DISTINCT accounting_document) as c FROM journal_entry_items')?.c || 0,
    payments: queryOne(db, 'SELECT COUNT(*) as c FROM payments')?.c || 0,
    products: queryOne(db, 'SELECT COUNT(*) as c FROM products')?.c || 0,
    plants: queryOne(db, 'SELECT COUNT(*) as c FROM plants')?.c || 0,
    totalOrderValue: queryOne(db, 'SELECT ROUND(SUM(CAST(total_net_amount AS REAL)), 2) as total FROM sales_order_headers')?.total || 0,
    totalBilledValue: queryOne(db, 'SELECT ROUND(SUM(CAST(total_net_amount AS REAL)), 2) as total FROM billing_document_headers WHERE billing_document_is_cancelled = 0')?.total || 0,
  };
}
