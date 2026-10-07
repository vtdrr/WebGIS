import { describe, expect, it, vi } from 'vitest';
import { detectLang, pick, saveLang, translate } from './index';
import { en, vi as viMessages } from './messages';

describe('translate', () => {
  it('returns the message for the language', () => {
    expect(translate('vi', 'route.title')).toBe('Chỉ đường');
    expect(translate('en', 'route.title')).toBe('Directions');
  });

  it('replaces placeholders and leaves unknown ones intact', () => {
    expect(translate('en', 'place.floor', { floor: 3 })).toBe('Floor 3');
    expect(translate('vi', 'sidebar.showing', { shown: 5, total: 12 })).toBe('Hiển thị 5 / 12 địa điểm');
    expect(translate('en', 'place.floor')).toBe('Floor {floor}');
  });

  it('falls back to the key itself for an unknown key', () => {
    expect(translate('en', 'nope.nothing' as never)).toBe('nope.nothing');
  });
});

describe('messages', () => {
  it('English defines exactly the Vietnamese keys, none empty', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(viMessages).sort());
    for (const [key, value] of Object.entries(en)) expect(value, key).not.toBe('');
  });

  it('uses the same placeholders in both languages', () => {
    const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
    for (const key of Object.keys(viMessages) as Array<keyof typeof viMessages>) {
      expect(placeholders(en[key]), key).toBe(placeholders(viMessages[key]));
    }
  });
});

describe('pick', () => {
  it('prefers English only in English mode and when filled in', () => {
    expect(pick('en', 'Tòa A1', 'Building A1')).toBe('Building A1');
    expect(pick('en', 'Tòa A1', null)).toBe('Tòa A1');
    expect(pick('en', 'Tòa A1', '')).toBe('Tòa A1');
    expect(pick('vi', 'Tòa A1', 'Building A1')).toBe('Tòa A1');
    expect(pick('vi', null, null)).toBe('');
  });
});

describe('detectLang / saveLang', () => {
  it('uses the saved language first', () => {
    saveLang('en');
    expect(detectLang()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    saveLang('vi');
    expect(detectLang()).toBe('vi');
  });

  it('falls back to the browser language, then Vietnamese', () => {
    vi.stubGlobal('navigator', { language: 'en-GB' });
    expect(detectLang()).toBe('en');
    vi.stubGlobal('navigator', { language: 'vi-VN' });
    expect(detectLang()).toBe('vi');
    vi.stubGlobal('navigator', { language: 'fr-FR' });
    expect(detectLang()).toBe('vi');
  });
});
