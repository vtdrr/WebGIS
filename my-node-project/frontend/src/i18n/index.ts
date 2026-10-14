import { vi, type MessageKey } from './messages';

export type Lang = 'vi';
export type { MessageKey };


/** Translate a key; {name} placeholders are replaced from `params`. */
export function translate(_lang: Lang, key: MessageKey, params?: Record<string, string | number>): string {
  const template = vi[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

/** The interface is intentionally Vietnamese-only. */
export function detectLang(): Lang {
  return 'vi';
}

/** Always display the Vietnamese place name/description. */
export function pick(_lang: Lang, vietnamese: string | null | undefined, _english?: string | null): string {
  return vietnamese ?? '';
}
