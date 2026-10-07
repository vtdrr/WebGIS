import { useStore } from '../../store/useStore';
import { useT } from '../../i18n/useT';

/** Toggles between Vietnamese and English. */
export function LanguageSwitch() {
  const { t, lang } = useT();
  const setLang = useStore((s) => s.setLang);
  return (
    <button
      type="button"
      className="icon-button icon-button--text"
      onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
      title={t('lang.switch')}
      aria-label={t('lang.switch')}
    >
      {t('lang.short')}
    </button>
  );
}
