export function queryAll(db, sql, params = []) {
  const stmt = db.prepare(sql);

  try {
    if (params.length > 0) {
      stmt.bind(params);
    }

    const results = [];
    const columns = stmt.getColumnNames();

    while (stmt.step()) {
      const row = stmt.get();
      const record = {};
      columns.forEach((column, index) => {
        record[column] = row[index];
      });
      results.push(record);
    }

    return results;
  } finally {
    stmt.free();
  }
}

export function queryOne(db, sql, params = []) {
  const results = queryAll(db, sql, params);
  return results[0] || null;
}
