import pg from 'pg';
import { config } from '../config/index.js';

const { Pool } = pg;

console.log('🔧 DB Config:', { 
  url: config.DATABASE_URL.replace(/:([^:@]+)@/, ':****@'), 
  ssl: config.DB_SSL 
});
export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  ssl: config.DB_SSL ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('🔴 Unexpected database pool error:', err);
  process.exit(-1);
});

export async function query<T extends pg.QueryResultRow = any>(text: string, params?: any[]): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  const res = await pool.query<T>(text, params);
  const duration = Date.now() - start;
  if (config.NODE_ENV === 'development') {
    console.log('📊 Query executed', { text: text.substring(0, 100), duration, rows: res.rowCount });
  }
  return res;
}

export async function getClient(): Promise<pg.PoolClient> {
  const client = await pool.connect();
  const originalQuery: (...args: any[]) => Promise<pg.QueryResult> = client.query.bind(client);
  const originalRelease = client.release.bind(client);

  // Monkey patch to log query time in dev
  if (config.NODE_ENV === 'development') {
    client.query = async (...args: any[]) => {
      const start = Date.now();
      try {
        return await originalQuery(...args);
      } finally {
        const duration = Date.now() - start;
        console.log('📊 Client query', { text: args[0]?.substring(0, 100), duration });
      }
    };
  }

  client.release = () => {
    client.query = originalQuery;
    return originalRelease();
  };

  return client;
}

export async function closePool(): Promise<void> {
  await pool.end();
}