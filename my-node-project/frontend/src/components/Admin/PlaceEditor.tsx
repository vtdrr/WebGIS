import { useRef, useState } from 'react';
import type { Category } from '../../types';
import { ApiError } from '../../services/api';
import { adminApi } from '../../services/adminApi';
import { useT } from '../../i18n/useT';
import { GeometryEditor } from './GeometryEditor';
import { AMENITY_KEYS, validateForm, type PlaceFormState } from './placeForm';
import type { MessageKey } from '../../i18n';

interface PlaceEditorProps {
  form: PlaceFormState;
  categories: Category[];
  adminKey: string;
  saving: boolean;
  onChange: (form: PlaceFormState) => void;
  onSubmit: () => void;
  onDelete?: () => void;
  onUnauthorized: () => void;
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`field${wide ? ' field--wide' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function PlaceEditor({ form, categories, adminKey, saving, onChange, onSubmit, onDelete, onUnauthorized }: PlaceEditorProps) {
  const { t, categoryName } = useT();
  const [submitted, setSubmitted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof PlaceFormState>(key: K, value: PlaceFormState[K]) => onChange({ ...form, [key]: value });
  const problems = validateForm(form);
  const showProblems = submitted && problems.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (problems.length === 0) onSubmit();
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      let images = form.images;
      for (const file of Array.from(files)) {
        const { url } = await adminApi.uploadImage(adminKey, file);
        images = [...images, { url, caption: '', is_primary: images.length === 0 }];
      }
      onChange({ ...form, images });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return onUnauthorized();
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <form className="editor" onSubmit={handleSubmit} noValidate>
      <h2>{form.id ? t('admin.form.edit') : t('admin.form.new')}</h2>

      <div className="editor__grid">
        <Field label={t('admin.form.nameVi')}>
          <input value={form.name_vi} onChange={(e) => set('name_vi', e.target.value)} required />
        </Field>
        <Field label={t('admin.form.nameEn')}>
          <input value={form.name_en} onChange={(e) => set('name_en', e.target.value)} />
        </Field>
        <Field label={t('admin.form.code')}>
          <input value={form.code} maxLength={50} onChange={(e) => set('code', e.target.value)} />
        </Field>
        <Field label={t('admin.form.category')}>
          <select value={form.category_id} onChange={(e) => set('category_id', e.target.value)}>
            <option value="">{t('admin.form.categoryPick')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {categoryName(c)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('admin.form.floor')}>
          <input value={form.floor} inputMode="numeric" onChange={(e) => set('floor', e.target.value)} />
        </Field>
        <Field label={t('admin.form.capacity')}>
          <input value={form.capacity} inputMode="numeric" onChange={(e) => set('capacity', e.target.value)} />
        </Field>
        <Field label={t('admin.form.phone')}>
          <input value={form.contact_phone} maxLength={20} onChange={(e) => set('contact_phone', e.target.value)} />
        </Field>
        <Field label={t('admin.form.email')}>
          <input type="email" value={form.contact_email} onChange={(e) => set('contact_email', e.target.value)} />
        </Field>
        <Field label={t('admin.form.descVi')} wide>
          <textarea rows={3} value={form.description_vi} onChange={(e) => set('description_vi', e.target.value)} />
        </Field>
        <Field label={t('admin.form.descEn')} wide>
          <textarea rows={3} value={form.description_en} onChange={(e) => set('description_en', e.target.value)} />
        </Field>
      </div>

      <fieldset>
        <legend>{t('admin.form.amenities')}</legend>
        <div className="editor__amenities">
          {AMENITY_KEYS.map((key) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={form.amenities[key] === true}
                onChange={(e) => set('amenities', { ...form.amenities, [key]: e.target.checked })}
              />
              {t(`attr.${key}` as MessageKey)}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>{t('admin.form.hours')}</legend>
        {form.hours.map((row, i) => (
          <div key={i} className="editor__hours-row">
            <input
              aria-label={t('admin.form.hoursDay')}
              placeholder={t('admin.form.hoursDay')}
              value={row.day}
              onChange={(e) => set('hours', form.hours.map((r, j) => (j === i ? { ...r, day: e.target.value } : r)))}
            />
            <input
              aria-label={t('admin.form.hoursTime')}
              placeholder={t('admin.form.hoursTime')}
              value={row.time}
              onChange={(e) => set('hours', form.hours.map((r, j) => (j === i ? { ...r, time: e.target.value } : r)))}
            />
            <button
              type="button"
              className="btn btn--small"
              aria-label={t('admin.form.removeRow')}
              onClick={() => set('hours', form.hours.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </div>
        ))}
        <button type="button" className="btn btn--small" onClick={() => set('hours', [...form.hours, { day: '', time: '' }])}>
          + {t('admin.form.addRow')}
        </button>
      </fieldset>

      <fieldset>
        <legend>{t('admin.form.images')}</legend>
        <div className="editor__images">
          {form.images.map((img, i) => (
            <figure key={`${img.url}-${i}`}>
              <img src={img.url} alt={img.caption || ''} />
              <input
                aria-label={t('admin.form.caption')}
                placeholder={t('admin.form.caption')}
                value={img.caption ?? ''}
                onChange={(e) => set('images', form.images.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)))}
              />
              <button
                type="button"
                className="btn btn--small"
                onClick={() => set('images', form.images.filter((_, j) => j !== i))}
              >
                {t('admin.form.remove')}
              </button>
            </figure>
          ))}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          aria-label={t('admin.form.upload')}
          disabled={uploading}
          onChange={(e) => handleFiles(e.target.files)}
        />
        {uploading && <span className="editor__note">{t('admin.form.uploading')}</span>}
        {uploadError && (
          <div className="alert alert--error alert--small" role="alert">
            {t('admin.error', { error: uploadError })}
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend>{t('admin.form.geometry')}</legend>
        <GeometryEditor
          key={form.id ?? 'new'}
          value={{ lat: form.lat, lng: form.lng, polygon: form.polygon }}
          onChange={(g) => onChange({ ...form, ...g })}
        />
      </fieldset>

      {showProblems && (
        <ul className="alert alert--error editor__problems" role="alert">
          {problems.map((p) => (
            <li key={p}>{t(p)}</li>
          ))}
        </ul>
      )}

      <div className="editor__actions">
        <button type="submit" className="btn btn--primary" disabled={saving || uploading}>
          {saving ? t('admin.saving') : t('admin.save')}
        </button>
        {onDelete && (
          <button type="button" className="btn btn--danger" onClick={onDelete} disabled={saving}>
            {t('admin.delete')}
          </button>
        )}
      </div>
    </form>
  );
}
