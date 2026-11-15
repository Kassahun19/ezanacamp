import mysql from 'mysql2/promise';
import { dbConfig } from './config.js';
import { mysqlSchemaStatements } from './schema.js';

let activeDriver = null;
let mysqlPool = null;
let initPromise = null;

export function toMysqlDatetime(input = new Date()) {
  const d = input instanceof Date ? input : new Date(input);
  const safe = Number.isNaN(d.getTime()) ? new Date() : d;
  return safe.toISOString().slice(0, 19).replace('T', ' ');
}

export async function initDatabase() {
  if (activeDriver === 'mysql' && mysqlPool) return activeDriver;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const { database, ...serverConfig } = dbConfig.mysql;
    try {
      const testPool = mysql.createPool(dbConfig.mysql);
      const conn = await testPool.getConnection();
      await conn.ping();
      conn.release();
      mysqlPool = testPool;
    } catch (err) {
      if (err?.code === 'ER_BAD_DB_ERROR') {
        const bootstrapConn = await mysql.createConnection(serverConfig);
        await bootstrapConn.query(
          `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
        );
        await bootstrapConn.end();
        mysqlPool = mysql.createPool(dbConfig.mysql);
      } else {
        initPromise = null;
        throw new Error(
          `Unable to connect to MySQL database "${database}" at ${dbConfig.mysql.host}:${dbConfig.mysql.port} as user "${dbConfig.mysql.user}": ${err.message}`
        );
      }
    }

    for (const stmt of mysqlSchemaStatements) {
      await mysqlPool.query(stmt);
    }

    // Ensure all live_classes rows point to the active Zoom meeting room
    await mysqlPool.query(
      `UPDATE live_classes SET meeting_url = 'https://us05web.zoom.us/j/4619028612?pwd=D8hDld9Qase3OLIDozrgc9axiBDadQ.1' WHERE meeting_url LIKE '%meet.ezana.edu.et%' OR meeting_url = ''`
    );

    activeDriver = 'mysql';
    console.log(`[DB] Connected to MySQL (${database}@${dbConfig.mysql.host}:${dbConfig.mysql.port})`);
    return activeDriver;
  })();

  return initPromise;
}

export function getDbDriver() {
  return activeDriver || 'mysql';
}

export async function query(sql, params = []) {
  await initDatabase();
  const [rows] = await mysqlPool.query(sql, params);
  return rows;
}

export async function get(sql, params = []) {
  await initDatabase();
  const [rows] = await mysqlPool.query(sql, params);
  return rows[0] || null;
}

export async function run(sql, params = []) {
  await initDatabase();
  const [result] = await mysqlPool.query(sql, params);
  return {
    lastInsertRowid: result.insertId,
    changes: result.affectedRows,
  };
}

export async function transaction(fn) {
  await initDatabase();
  const conn = await mysqlPool.getConnection();
  try {
    await conn.beginTransaction();
    const tx = {
      query: async (sql, params = []) => {
        const [rows] = await conn.query(sql, params);
        return rows;
      },
      get: async (sql, params = []) => {
        const [rows] = await conn.query(sql, params);
        return rows[0] || null;
      },
      run: async (sql, params = []) => {
        const [result] = await conn.query(sql, params);
        return { lastInsertRowid: result.insertId, changes: result.affectedRows };
      },
    };
    const out = await fn(tx);
    await conn.commit();
    return out;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
