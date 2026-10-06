import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { pool } from './pool.js';
import { config } from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigrations(): Promise<void> {
  console.log('🔄 Running database migrations...');

  const sqlPath = join(__dirname, '../../sql/init.sql');
  const sql = readFileSync(sqlPath, 'utf-8');

  // Split by semicolon but respect dollar-quoted strings and comments
  const statements = splitSqlStatements(sql);

  console.log(`📝 Parsed ${statements.length} SQL statements`);
  
  const client = await pool.connect();
  try {
    // Don't use transaction - run each statement individually for idempotency
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const trimmed = stmt.trim();
      if (!trimmed) continue;
      // Strip leading comment lines so statements preceded by comments still run
      const withoutLeadingComments = trimmed.replace(/^(--[^\n]*\n\s*)+/, '').trim();
      if (!withoutLeadingComments) continue;
      const stmtToRun = withoutLeadingComments;

      try {
        await client.query(stmtToRun);
        if (config.NODE_ENV === 'development') {
          console.log(`  ✓ [${i+1}/${statements.length}]`, stmtToRun.substring(0, 80).replace(/\n/g, ' ') + (stmtToRun.length > 80 ? '...' : ''));
        }
      } catch (err: any) {
        // Ignore "already exists" errors for idempotency
        if (err.code === '42710' || err.code === '42P07' || err.code === '23505' || err.code === '42701') {
          if (config.NODE_ENV === 'development') {
            console.log(`  ⊘ [${i+1}/${statements.length}] Skipped (already exists):`, stmtToRun.substring(0, 80));
          }
        } else {
          console.error(`  ❌ [${i+1}/${statements.length}] FAILED:`, err.message);
          console.error('     SQL:', stmtToRun.substring(0, 200));
          throw err;
        }
      }
    }
    console.log('✅ Migrations completed successfully');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inDollarQuote = false;
  let dollarTag = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const nextChar = sql[i + 1];
    const prevChar = sql[i - 1];

    // Handle line comments
    if (!inDollarQuote && !inSingleQuote && !inDoubleQuote && !inBlockComment) {
      if (char === '-' && nextChar === '-') {
        inLineComment = true;
      }
    }

    if (inLineComment && char === '\n') {
      inLineComment = false;
    }

    // Handle block comments
    if (!inDollarQuote && !inSingleQuote && !inDoubleQuote && !inLineComment) {
      if (char === '/' && nextChar === '*') {
        inBlockComment = true;
        i++; // skip next char
        continue;
      }
      if (char === '*' && nextChar === '/' && inBlockComment) {
        inBlockComment = false;
        i++; // skip next char
        continue;
      }
    }

    if (inLineComment || inBlockComment) {
      current += char;
      continue;
    }

    // Handle dollar quotes ($tag$ ... $tag$)
    if (!inSingleQuote && !inDoubleQuote) {
      const dollarMatch = sql.slice(i).match(/^\$([a-zA-Z0-9_]*)\$/);
      if (dollarMatch) {
        if (!inDollarQuote) {
          inDollarQuote = true;
          dollarTag = dollarMatch[1];
        } else if (dollarMatch[1] === dollarTag) {
          inDollarQuote = false;
          dollarTag = '';
        }
      }
    }

    // Handle single quotes
    if (!inDollarQuote && !inDoubleQuote && char === "'" && prevChar !== '\\') {
      inSingleQuote = !inSingleQuote;
    }

    // Handle double quotes
    if (!inDollarQuote && !inSingleQuote && char === '"' && prevChar !== '\\') {
      inDoubleQuote = !inDoubleQuote;
    }

    current += char;

    // Statement separator
    if (!inDollarQuote && !inSingleQuote && !inDoubleQuote && !inLineComment && !inBlockComment) {
      if (char === ';') {
        statements.push(current);
        current = '';
      }
    }
  }

  if (current.trim()) {
    statements.push(current);
  }

  return statements;
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => {
      console.log('✅ Process exiting successfully');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Caught error in main:', err);
      process.exit(1);
    });
}

export { runMigrations };