import { describe, expect, it, vi } from 'vitest';
import { detectLang, pick, translate } from './index';

describe('Vietnamese-only localization', () => {
  it('returns Vietnamese messages and interpolates placeholders', () => {
    expect(translate('vi', 'route.title')).toBe('Chỉ đường');
    expect(translate('vi', 'place.floor', { floor: 3 })).toBe('Tầng 3');
    expect(translate('vi', 'sidebar.showing', { shown: 5, total: 12 })).toBe('Hiển thị 5 / 12 địa điểm');
    expect(translate('vi', 'nope.nothing' as never)).toBe('nope.nothing');
  });

  it('always displays Vietnamese place text', () => {
    expect(pick('vi', 'Tòa A1', 'Building A1')).toBe('Tòa A1');
    expect(pick('vi', null, 'English fallback')).toBe('');
  });

  it('ignores old saved and browser language preferences', () => {
    localStorage.setItem('webgis.lang', 'en');
    vi.stubGlobal('navigator', { language: 'en-GB' });
    expect(detectLang()).toBe('vi');
    vi.stubGlobal('navigator', { language: 'fr-FR' });
    expect(detectLang()).toBe('vi');
  });
});
