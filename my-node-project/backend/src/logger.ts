import { config } from './config/index.js';

/**
 * Minimal leveled logger for code that runs outside a Fastify request
 * (DB pool, CLI scripts). Silent in tests; debug output only in development.
 */
type Level = 'debug' | 'info' | 'warn' | 'error';

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const threshold: number =
  config.NODE_ENV === 'test' ? Infinity : config.NODE_ENV === 'development' ? ORDER.debug : ORDER.info;

function write(level: Level, message: string, meta?: unknown): void {
  if (ORDER[level] < threshold) return;
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}`;
  const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (meta === undefined) out(line);
  else out(line, meta);
}

export const logger = {
  debug: (message: string, meta?: unknown) => write('debug', message, meta),
  info: (message: string, meta?: unknown) => write('info', message, meta),
  warn: (message: string, meta?: unknown) => write('warn', message, meta),
  error: (message: string, meta?: unknown) => write('error', message, meta),
};
