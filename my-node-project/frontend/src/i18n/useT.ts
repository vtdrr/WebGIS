import { useCallback } from 'react';
import { useStore } from '../store/useStore';
import { pick, translate, type Lang, type MessageKey } from './index';
import type { Category, Place } from '../types';

export type TFunction = (key: MessageKey, params?: Record<string, string | number>) => string;

/** Translation helpers bound to the current UI language. */
export function useT() {
  const lang = useStore((s) => s.lang);
  const t: TFunction = useCallback((key, params) => translate(lang, key, params), [lang]);
  return {
    lang,
    t,
    placeName: (p: Pick<Place, 'name_vi' | 'name_en'>) => pick(lang, p.name_vi, p.name_en),
    placeDescription: (p: Pick<Place, 'description_vi' | 'description_en'>) => pick(lang, p.description_vi, p.description_en),
    placeCategory: (p: Pick<Place, 'category_name_vi' | 'category_name_en' | 'category_code'>) =>
      pick(lang, p.category_name_vi, p.category_name_en) || p.category_code || '',
    categoryName: (c: Pick<Category, 'name_vi' | 'name_en'>) => pick(lang, c.name_vi, c.name_en),
  };
}

export type { Lang };
