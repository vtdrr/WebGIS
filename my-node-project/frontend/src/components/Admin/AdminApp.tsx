import { useCallback, useEffect, useState } from 'react';
import { categoriesApi, placesApi, ApiError } from '../../services/api';
import { adminApi, adminKey } from '../../services/adminApi';
import { useStore } from '../../store/useStore';
import { useT } from '../../i18n/useT';
import { LanguageSwitch } from '../UI/LanguageSwitch';
import { PlaceEditor } from './PlaceEditor';
import { emptyForm, formToPayload, placeToForm, type PlaceFormState } from './placeForm';
import type { Category, Place } from '../../types';

const PAGE_SIZE = 20;

function Login({ onLogin }: { onLogin: (key: string) => void }) {
  const { t } = useT();
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminApi.verify(key);
      onLogin(key);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? t('admin.login.invalid') : t('admin.login.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-login">
      <form onSubmit={submit}>
        <h1>{t('admin.login.title')}</h1>
        <p>{t('admin.login.hint')}</p>
        <label className="field">
          <span>{t('admin.login.key')}</span>
          <input type="password" value={key} onChange={(e) => setKey(e.target.value)} autoFocus autoComplete="current-password" />
        </label>
        {error && (
          <div className="alert alert--error alert--small" role="alert">
            {error}
          </div>
        )}
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {t('admin.login.submit')}
        </button>
      </form>
    </div>
  );
}

export default function AdminApp() {
  const { t, placeName } = useT();
  const lang = useStore((s) => s.lang);
  const [key, setKey] = useState<string | null>(() => adminKey.get());
  const [categories, setCategories] = useState<Category[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<PlaceFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const logout = useCallback(() => {
    adminKey.clear();
    setKey(null);
  }, []);

  const unauthorized = useCallback(() => {
    adminKey.clear();
    setKey(null);
    setNotice({ kind: 'error', text: t('admin.sessionExpired') });
  }, [t]);

  useEffect(() => {
    document.title = `${t('admin.title')} - Phenikaa WebGIS`;
  }, [t]);

  useEffect(() => {
    if (key) categoriesApi.list().then(setCategories).catch(() => undefined);
  }, [key]);

  const loadPlaces = useCallback(async () => {
    try {
      const res = await placesApi.list({ page, limit: PAGE_SIZE, sort: 'name_vi', order: 'asc', q: q.trim() || undefined });
      setPlaces(res.data);
      setMeta({ page: res.meta.page, totalPages: Math.max(1, res.meta.totalPages), total: res.meta.total });
    } catch (err) {
      setNotice({ kind: 'error', text: t('admin.error', { error: err instanceof Error ? err.message : String(err) }) });
    }
  }, [page, q, t]);

  // Debounced list loading
  useEffect(() => {
    if (!key) return;
    const timer = setTimeout(loadPlaces, 250);
    return () => clearTimeout(timer);
  }, [key, loadPlaces]);

  if (!key) {
    return (
      <>
        {notice && <div className="alert alert--error admin-notice" role="alert">{notice.text}</div>}
        <Login
          onLogin={(k) => {
            adminKey.set(k);
            setNotice(null);
            setKey(k);
          }}
        />
      </>
    );
  }

  const fail = (err: unknown) => {
    if (err instanceof ApiError && err.status === 401) return unauthorized();
    setNotice({ kind: 'error', text: t('admin.error', { error: err instanceof Error ? err.message : String(err) }) });
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setNotice(null);
    try {
      const saved = form.id
        ? await adminApi.updatePlace(key, form.id, formToPayload(form, 'update'))
        : await adminApi.createPlace(key, formToPayload(form, 'create'));
      setForm(placeToForm(saved));
      setNotice({ kind: 'ok', text: t('admin.saved') });
      await loadPlaces();
    } catch (err) {
      fail(err);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!form?.id || !window.confirm(t('admin.deleteConfirm', { name: form.name_vi }))) return;
    setSaving(true);
    try {
      await adminApi.deletePlace(key, form.id);
      setForm(null);
      setNotice({ kind: 'ok', text: t('admin.deleted') });
      await loadPlaces();
    } catch (err) {
      fail(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin" lang={lang}>
      <header className="admin__header">
        <h1>{t('admin.title')}</h1>
        <div className="admin__header-actions">
          <LanguageSwitch />
          <a className="btn btn--small" href="#/">{t('admin.back')}</a>
          <button type="button" className="btn btn--small" onClick={logout}>{t('admin.logout')}</button>
        </div>
      </header>

      <div className="admin__body">
        <aside className="admin__list">
          <div className="admin__list-tools">
            <input
              type="search"
              value={q}
              placeholder={t('admin.search')}
              aria-label={t('admin.search')}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
            <button type="button" className="btn btn--primary" onClick={() => { setForm(emptyForm()); setNotice(null); }}>
              + {t('admin.new')}
            </button>
          </div>

          <ul>
            {places.length === 0 && <li className="admin__empty">{t('admin.empty')}</li>}
            {places.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={form?.id === p.id ? 'is-active' : ''}
                  onClick={() => { setForm(placeToForm(p)); setNotice(null); }}
                >
                  <span className="dot dot--lg" style={{ background: p.category_color || '#3388ff' }} />
                  <span>
                    <strong>{placeName(p)}</strong>
                    {p.code && <small>{p.code}</small>}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="admin__pager">
            <button type="button" className="btn btn--small" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              {t('admin.prev')}
            </button>
            <span>{t('admin.page', { page: meta.page, total: meta.totalPages })}</span>
            <button type="button" className="btn btn--small" disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)}>
              {t('admin.next')}
            </button>
          </div>
        </aside>

        <main className="admin__main">
          {notice && (
            <div className={`alert ${notice.kind === 'ok' ? 'alert--ok' : 'alert--error'} admin-notice`} role={notice.kind === 'ok' ? 'status' : 'alert'}>
              {notice.text}
            </div>
          )}
          {form ? (
            <PlaceEditor
              form={form}
              categories={categories}
              adminKey={key}
              saving={saving}
              onChange={setForm}
              onSubmit={save}
              onDelete={form.id ? remove : undefined}
              onUnauthorized={unauthorized}
            />
          ) : (
            <p className="admin__empty">{t('admin.form.pick')}</p>
          )}
        </main>
      </div>
    </div>
  );
}
