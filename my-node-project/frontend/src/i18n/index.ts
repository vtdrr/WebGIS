import { en, vi, type MessageKey } from './messages';

export type Lang = 'vi' | 'en';
export type { MessageKey };

export const LANGS: Lang[] = ['vi', 'en'];
const STORAGE_KEY = 'webgis.lang';

const dictionaries: Record<Lang, Record<MessageKey, string>> = { vi, en };

/** Translate a key; {name} placeholders are replaced from `params`. */
export function translate(lang: Lang, key: MessageKey, params?: Record<string, string | number>): string {
  const template = dictionaries[lang][key] ?? vi[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

/** Language from localStorage, else from the browser, else Vietnamese. */
export function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'vi' || saved === 'en') return saved;
  } catch {
    /* storage unavailable */
  }
  if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('en')) return 'en';
  return 'vi';
}

export function saveLang(lang: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* storage unavailable */
  }
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}

/** English text when the language is English and the English field is filled, else Vietnamese. */
export function pick(lang: Lang, vietnamese: string | null | undefined, english: string | null | undefined): string {
  return (lang === 'en' && english ? english : vietnamese) ?? '';
}
