import { existsSync, readFileSync } from 'node:fs';
import pg from 'pg';
import { config } from '../config/index.js';
import { logger } from '../logger.js';

const { Pool } = pg;

/** CA certificate: DB_SSL_CA may hold the PEM itself or a path to a PEM file. */
function resolveCa(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.includes('BEGIN CERTIFICATE')) return value.replace(/\\n/g, '\n');
  if (existsSync(value)) return readFileSync(value, 'utf-8');
  throw new Error(`DB_SSL_CA is neither a PEM certificate nor an existing file: ${value}`);
}

function sslOptions(): pg.PoolConfig['ssl'] {
  if (!config.DB_SSL) return false;
  const ca = resolveCa(config.DB_SSL_CA);
  if (!config.DB_SSL_REJECT_UNAUTHORIZED) {
    logger.warn('DB_SSL_REJECT_UNAUTHORIZED=false: the database certificate is NOT verified');
  }
  return { rejectUnauthorized: config.DB_SSL_REJECT_UNAUTHORIZED, ...(ca && { ca }) };
}

logger.debug('DB config', {
  url: config.DATABASE_URL.replace(/:([^:@]+)@/, ':****@'),
  ssl: config.DB_SSL,
});

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  ssl: sslOptions(),
  max: config.DB_POOL_MAX,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// An idle client erroring (e.g. DB restart) must not take the API down:
// the pool discards the broken client and opens a new one on demand.
pool.on('error', (err) => {
  logger.error('Unexpected error on idle database client', err);
});

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  const res = await pool.query<T>(text, params);
  logger.debug('Query executed', { text: text.substring(0, 100), duration: Date.now() - start, rows: res.rowCount });
  return res;
}

export async function getClient(): Promise<pg.PoolClient> {
  return pool.connect();
}

/** True when the database answers a trivial query. */
export async function isDatabaseReachable(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
