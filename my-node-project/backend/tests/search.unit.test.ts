import { describe, expect, it } from 'vitest';
import { parseSearch, tokenizeSearch } from '../src/modules/places/search.js';

describe('tokenizeSearch', () => {
  it('lowercases and splits on whitespace', () => {
    expect(tokenizeSearch('Thư  Viện')).toEqual(['thư', 'viện']);
  });

  it('drops tsquery operators and punctuation', () => {
    expect(tokenizeSearch("a & b | !c (d) <-> e:* 'f' \\g")).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  });

  it('splits hyphenated codes', () => {
    expect(tokenizeSearch('A1-101')).toEqual(['a1', '101']);
  });

  it('keeps digits and non-latin letters', () => {
    expect(tokenizeSearch('Phòng 101 Đa năng')).toEqual(['phòng', '101', 'đa', 'năng']);
  });

  it('normalizes decomposed unicode', () => {
    expect(tokenizeSearch('thư viện'.normalize('NFD'))).toEqual(['thư', 'viện']);
  });

  it('returns an empty list when nothing is searchable', () => {
    expect(tokenizeSearch('&&& !!! ---')).toEqual([]);
    expect(tokenizeSearch('   ')).toEqual([]);
    expect(tokenizeSearch('')).toEqual([]);
  });

  it('limits the number and length of tokens', () => {
    expect(tokenizeSearch('a b c d e f g h i j k l')).toHaveLength(8);
    expect(tokenizeSearch('x'.repeat(500))[0]).toHaveLength(50);
  });
});

describe('parseSearch', () => {
  it('builds a prefix tsquery joined with AND', () => {
    expect(parseSearch('thu vi')).toEqual({
      term: 'thu vi',
      codeFragment: 'thu-vi',
      tsquery: 'thu:* & vi:*',
    });
  });

  it('keeps hyphens in the code fragment so codes stay searchable', () => {
    expect(parseSearch('E2E-1791349966')?.codeFragment).toBe('e2e-1791349966');
    expect(parseSearch('LIB-MAIN')?.codeFragment).toBe('lib-main');
    expect(parseSearch('  A1-101 ')?.codeFragment).toBe('a1-101');
  });

  it('turns runs of other punctuation into a single hyphen', () => {
    expect(parseSearch('a1 / 101')?.codeFragment).toBe('a1-101');
    // Nothing searchable at all, so no parsed search
    expect(parseSearch('***')).toBeNull();
  });

  it('returns null for input without letters or digits', () => {
    expect(parseSearch('&&&')).toBeNull();
    expect(parseSearch('')).toBeNull();
  });

  it('only ever produces letters, digits and tsquery operators we add', () => {
    const parsed = parseSearch("x'; DROP TABLE places; -- & | ! <-> :*");
    expect(parsed?.tsquery).toMatch(/^[\p{L}\p{N}]+:\*( & [\p{L}\p{N}]+:\*)*$/u);
  });
});
