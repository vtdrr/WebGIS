// =============================================
// Search helpers (accent-insensitive prefix search)
// =============================================

const MAX_TOKENS = 8;
const MAX_TOKEN_LENGTH = 50;

/**
 * Split user input into plain lowercase letter/digit tokens.
 * Everything else (operators like & | ! : * ( ) < >, quotes, backslashes, hyphens...)
 * is dropped, so the result is always safe to embed in a tsquery.
 */
export function tokenizeSearch(input: string): string[] {
  const tokens = input
    .normalize('NFC')
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu);
  if (!tokens) return [];
  return tokens.slice(0, MAX_TOKENS).map((t) => t.slice(0, MAX_TOKEN_LENGTH));
}

export interface ParsedSearch {
  /** Clean text, e.g. "thu vi" — used for trigram similarity and prefix/code comparison */
  term: string;
  /**
   * Lowercase fragment for substring matching against `code`. Keeps hyphens, because
   * place codes look like "LIB-MAIN" or "E2E-1791349966" and dropping the hyphen would
   * produce "e21791349966", which matches nothing.
   */
  codeFragment: string;
  /** tsquery source with prefix matching on every token, e.g. "thu:* & vi:*" */
  tsquery: string;
}

/** Returns null when the input has no searchable characters. */
export function parseSearch(input: string): ParsedSearch | null {
  const tokens = tokenizeSearch(input);
  if (tokens.length === 0) return null;
  const codeFragment = input
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_TOKEN_LENGTH);
  return {
    term: tokens.join(' '),
    codeFragment,
    tsquery: tokens.map((t) => `${t}:*`).join(' & '),
  };
}

/**
 * SQL predicate shared by the search endpoint and the `q` filter of the list endpoint:
 * prefix full-text match OR trigram similarity (typo tolerance) OR substring match
 * on the place code (so "E2E-1" finds "E2E-1791349044219"), accent-insensitive.
 * `tsParam`, `termParam` and `codeParam` are 1-based placeholder indexes.
 */
export function matchCondition(tsParam: number, termParam: number, codeParam: number): string {
  return `(
    p.search_tsv @@ to_tsquery('simple', f_unaccent($${tsParam}))
    OR f_unaccent(p.name_vi) % f_unaccent($${termParam})
    OR p.code ILIKE '%' || f_unaccent($${codeParam}) || '%'
  )`;
}
