import { describe, expect, it } from 'vitest';
import { translate } from '../i18n';
import { escapeHtml, formatDistance, formatDuration, formatOpeningHours, hoursForDay } from './format';

const tVi = (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) => translate('vi', key, params);
const tEn = (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) => translate('en', key, params);

describe('formatDistance', () => {
  it('uses metres below 1 km and km above', () => {
    expect(formatDistance(84.4)).toBe('84 m');
    expect(formatDistance(999)).toBe('999 m');
    expect(formatDistance(1000)).toBe('1.0 km');
    expect(formatDistance(2540)).toBe('2.5 km');
  });
});

describe('formatDuration', () => {
  it('formats seconds, minutes and hours', () => {
    expect(formatDuration(30, tVi)).toBe('30 giây');
    expect(formatDuration(90, tVi)).toBe('2 phút');
    expect(formatDuration(3900, tVi)).toBe('1 giờ 5 phút');
    expect(formatDuration(3900, tEn)).toBe('1 h 5 min');
  });
});

describe('opening hours', () => {
  const hours = { 'mon-fri': '07:00-22:00', sat: '08:00-17:00', sun: 'closed' };

  it('picks the key for the weekday', () => {
    expect(hoursForDay(hours, 1)).toBe('07:00-22:00');
    expect(hoursForDay(hours, 5)).toBe('07:00-22:00');
    expect(hoursForDay(hours, 6)).toBe('08:00-17:00');
    expect(hoursForDay(hours, 0)).toBe('closed');
  });

  it('understands the "mon-sun" key used by the seed data', () => {
    for (let day = 0; day < 7; day++) expect(hoursForDay({ 'mon-sun': '00:00-24:00' }, day)).toBe('00:00-24:00');
  });

  it('summarises today, treating missing data and "closed" as closed', () => {
    expect(formatOpeningHours(hours, tVi, 2)).toBe('Mở: 07:00-22:00');
    expect(formatOpeningHours(hours, tVi, 0)).toBe('Đóng cửa hôm nay');
    expect(formatOpeningHours({ sat: '08:00-17:00' }, tEn, 3)).toBe('Closed today');
    expect(formatOpeningHours({ 'mon-sun': '00:00-24:00' }, tEn, 0)).toBe('Open: 00:00-24:00');
  });
});

describe('escapeHtml', () => {
  it('escapes markup and quotes', () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')">&`)).toBe(
      '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;',
    );
  });
});
