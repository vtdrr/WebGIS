import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../../store/useStore';
import { useT } from '../../i18n/useT';

export function CategoryFilter() {
  const { t, categoryName } = useT();
  const { categories, activeCategoryFilter, setActiveCategoryFilter } = useStore(
    useShallow((state) => ({
      categories: state.categories,
      activeCategoryFilter: state.activeCategoryFilter,
      setActiveCategoryFilter: state.setActiveCategoryFilter,
    })),
  );

  const toggle = (code: string) => setActiveCategoryFilter(code === activeCategoryFilter ? null : code);

  return (
    <div className="category-filter">
      <div className="category-filter__head">
        <span className="section-title">{t('category.title')}</span>
        {activeCategoryFilter && (
          <button type="button" className="link-button" onClick={() => setActiveCategoryFilter(null)}>
            {t('category.clear')}
          </button>
        )}
      </div>
      <div className="category-filter__list">
        {categories.map((category) => {
          const active = activeCategoryFilter === category.code;
          return (
            <label
              key={category.code}
              className={`category-filter__item${active ? ' is-active' : ''}`}
              style={active ? { background: `${category.color}15`, borderColor: category.color } : undefined}
            >
              <input
                type="checkbox"
                checked={active}
                onChange={() => toggle(category.code)}
                style={{ accentColor: category.color }}
              />
              <span
                className="dot dot--lg"
                style={{ background: category.color, boxShadow: active ? `0 0 0 2px ${category.color}` : 'none' }}
              />
              <span className="category-filter__name">{categoryName(category)}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
