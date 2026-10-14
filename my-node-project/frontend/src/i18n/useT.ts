import { useCallback } from 'react';
import { useStore } from '../store/useStore';
import { pick, translate, type Lang, type MessageKey } from './index';
import type { Category, Place } from '../types';

export type TFunction = (key: MessageKey, params?: Record<string, string | number>) => string;

/** Vietnamese translation helpers for UI strings and place data. */
export function useT() {
  const lang = useStore((s) => s.lang);
  const t: TFunction = useCallback((key, params) => translate(lang, key, params), [lang]);
  return {
    lang,
    t,
    placeName: (p: Pick<Place, 'name_vi'>) => pick(lang, p.name_vi),
    placeDescription: (p: Pick<Place, 'description_vi'>) => pick(lang, p.description_vi),
    placeCategory: (p: Pick<Place, 'category_name_vi' | 'category_code'>) => pick(lang, p.category_name_vi) || p.category_code || '',
    categoryName: (c: Pick<Category, 'name_vi'>) => pick(lang, c.name_vi),
  };
}

export type { Lang };
