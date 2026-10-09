import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import { formatPrice, digitsOnly } from '../lib/format.js';
import { Field } from '../components/Field.jsx';
import { UploadIcon, CloseIcon, PlusIcon } from '../components/Icons.jsx';
import { ErrorState } from '../components/States.jsx';
import { useAuth } from '../lib/auth.jsx';
import { legalTitle } from './Legal.jsx';

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_PHOTOS = 8;
let photoKey = 0;

const EMPTY = {
  title: '',
  category: '',
  price_vnd: '',
  district: '',
  condition: '',
  description: '',
  seller_name: '',
  seller_phone: '',
  seller_email: '',
};

export function Sell() {
  const { t, lang } = useI18n();
  const { profile, loading: authLoading, openSignIn } = useAuth();
  const navigate = useNavigate();
  const fileInput = useRef(null);

  const [meta, setMeta] = useState({ categories: [], districts: [], conditions: [], fee_vnd: null, first_listing_free: false });
  const [values, setValues] = useState(EMPTY);
  // Each photo keeps its File, a stable key for React, and an object URL for the preview.
  const [photos, setPhotos] = useState([]);
  const photosRef = useRef(photos);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [metaStatus, setMetaStatus] = useState('loading');
  const [metaAttempt, setMetaAttempt] = useState(0);

  useEffect(() => {
    if (profile) setValues((current) => ({ ...current, seller_name: current.seller_name || profile.name, seller_email: profile.email }));
  }, [profile]);

  useEffect(() => {
    let active = true;
    setMetaStatus('loading');
    api.meta().then((data) => {
      if (!active) return;
      setMeta(data);
      setMetaStatus('ready');
    }).catch(() => active && setMetaStatus('error'));
    return () => { active = false; };
  }, [metaAttempt]);

  // Object URLs have to be released or the tab leaks memory; revoke whatever is left on unmount.
  useEffect(() => { photosRef.current = photos; }, [photos]);
  useEffect(() => () => photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url)), []);

  const maxPhotos = meta.max_photos || DEFAULT_MAX_PHOTOS;

  const set = (key) => (event) => {
    const value = key === 'price_vnd' ? digitsOnly(event.target.value) : event.target.value;
    setValues((current) => ({ ...current, [key]: value }));
  };

  const errorFor = (key) => {
    const code = errors[key];
    if (!code) return undefined;
    if (key === 'seller_phone') return t('sell.errorPhone');
    if (key === 'seller_email') return t('sell.errorEmail');
    if (key === 'price_vnd') return t('sell.errorPrice');
    return code === 'invalid' ? t('sell.errorInvalid') : t('sell.errorLength');
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});

    const body = new FormData();
    Object.entries(values).forEach(([key, value]) => body.append(key, value));
    body.append('lang', lang);
    photos.forEach((photo) => body.append('images', photo.file));

    try {
      const created = await api.createListing(body);
      // To the payment page (a free first listing just shows its review status there).
      navigate(`/payment/${created.id}`, { replace: true });
    } catch (error) {
      if (error.payload?.fields) setErrors(error.payload.fields);
      else if (error.payload?.error === 'image_too_large') setErrors({ image: 'too_large' });
      else if (error.payload?.error === 'too_many_images') setErrors({ image: 'too_many' });
      else setErrors({ form: 'error' });
      setSubmitting(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const addPhotos = (fileList) => {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;
    let problem = null;
    const accepted = [];
    for (const file of files) {
      if (!PHOTO_TYPES.includes(file.type)) { problem = problem ?? 'type'; continue; }
      if (file.size > MAX_PHOTO_BYTES) { problem = problem ?? 'too_large'; continue; }
      accepted.push(file);
    }
    const room = maxPhotos - photos.length;
    if (accepted.length > room) problem = 'too_many';
    const added = accepted.slice(0, Math.max(room, 0)).map((file) => ({ file, key: ++photoKey, url: URL.createObjectURL(file) }));
    setPhotos((current) => [...current, ...added]);
    setErrors((current) => {
      const { image: ignored, ...rest } = current;
      return problem ? { ...rest, image: problem } : rest;
    });
    if (fileInput.current) fileInput.current.value = '';
  };

  const removePhoto = (key) => {
    setPhotos((current) => {
      const gone = current.find((photo) => photo.key === key);
      if (gone) URL.revokeObjectURL(gone.url);
      return current.filter((photo) => photo.key !== key);
    });
    setErrors((current) => {
      const { image: ignored, ...rest } = current;
      return rest;
    });
  };

  const makeCover = (key) => {
    setPhotos((current) => {
      const chosen = current.find((photo) => photo.key === key);
      return chosen ? [chosen, ...current.filter((photo) => photo.key !== key)] : current;
    });
  };

  const onDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    addPhotos(event.dataTransfer.files);
  };

  const imageError = errors.image === 'too_large'
    ? t('sell.errorImage')
    : errors.image === 'too_many'
      ? t('sell.errorTooMany', { max: maxPhotos })
      : errors.image ? t('sell.errorImageType') : null;

  const feeLabel = meta.fee_vnd == null ? '…' : formatPrice(meta.fee_vnd, lang);
  const hasErrors = Object.keys(errors).length > 0;

  if (authLoading) return <div className="shell section"><p role="status">{t('common.loading')}</p></div>;
  if (!profile) return <div className="shell section messages-gate"><h1>{t('auth.sellTitle')}</h1><p className="lead">{t('auth.sellBody')}</p><button className="btn btn--accent" onClick={openSignIn}>{t('auth.signIn')}</button></div>;

  if (metaStatus !== 'ready') {
    return <div className="shell section sell-page"><h1>{t('sell.title')}</h1>{metaStatus === 'error' ? <ErrorState onRetry={() => setMetaAttempt((value) => value + 1)} /> : <p role="status">{t('common.loading')}</p>}</div>;
  }

  return (
    <div className="shell section sell-page editorial-page">
      <header className="sell-intro reveal-on-scroll">
        <div>
          <p className="eyebrow">{t('sell.eyebrow')}</p>
          <h1>{t('sell.title')}</h1>
          <p className="lead">{t('sell.lead')}</p>
        </div>
        <div className="sell-fee-lockup">
          <span>{meta.first_listing_free ? t('sell.freeLockup') : feeLabel}</span>
          <small>{meta.first_listing_free ? t('sell.freeLockupNote') : t('common.perListing')}</small>
        </div>
      </header>

      <div className="notice notice--accent fee-notice">
        {meta.first_listing_free ? (
          <>
            <p className="notice__title">{t('sell.freeNoticeTitle')}</p>
            <p style={{ margin: 0 }}>{t('sell.freeNoticeBody', { fee: feeLabel })}</p>
          </>
        ) : (
          <>
            <p className="notice__title">{t('sell.feeNoticeTitle', { fee: feeLabel })}</p>
            <p style={{ margin: 0 }}>{t('sell.feeNoticeBody')}</p>
          </>
        )}
      </div>

      {hasErrors && (
        <div className="notice notice--danger" style={{ marginBottom: 24 }} role="alert">
          <p className="notice__title">{t('sell.errorTitle')}</p>
          {imageError && <p style={{ margin: 0 }}>{imageError}</p>}
          {errors.form && <p style={{ margin: 0 }}>{t('common.error')}</p>}
        </div>
      )}

      <form className="form sell-form" onSubmit={onSubmit} noValidate>
        <div className="field">
          <span className="field__label">{t('sell.photoLabel')}</span>
          <div
            className={`uploader${dragging ? ' is-dragging' : ''}${photos.length ? ' has-photos' : ''}`}
            onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
            onDrop={onDrop}
          >
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              onChange={(event) => addPhotos(event.target.files)}
            />
            {photos.length === 0 ? (
              <>
                <div className="uploader__drop-icon"><UploadIcon size={28} /></div>
                <div className="uploader__copy">
                  <strong>{t('sell.photoDropTitle')}</strong>
                  <span className="field__hint">{t('sell.photoHint', { max: maxPhotos })}</span>
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => fileInput.current?.click()}>
                    {t('sell.photoChoose')}
                  </button>
                </div>
              </>
            ) : (
              <div className="uploader__gallery">
                <ul className="photo-grid">
                  {photos.map((photo, index) => (
                    <li key={photo.key} className={`photo-tile${index === 0 ? ' is-cover' : ''}`}>
                      <img src={photo.url} alt={t('sell.photoPreviewAlt')} />
                      {index === 0 ? (
                        <span className="photo-tile__badge">{t('sell.photoCover')}</span>
                      ) : (
                        <button type="button" className="photo-tile__cover" onClick={() => makeCover(photo.key)}>
                          {t('sell.photoMakeCover')}
                        </button>
                      )}
                      <button
                        type="button"
                        className="photo-tile__remove"
                        aria-label={t('sell.photoRemove')}
                        title={t('sell.photoRemove')}
                        onClick={() => removePhoto(photo.key)}
                      >
                        <CloseIcon size={16} />
                      </button>
                    </li>
                  ))}
                  {photos.length < maxPhotos && (
                    <li>
                      <button type="button" className="photo-tile photo-tile--add" onClick={() => fileInput.current?.click()}>
                        <PlusIcon size={22} />
                        <span>{t('sell.photoChange')}</span>
                      </button>
                    </li>
                  )}
                </ul>
                <span className="field__hint">
                  {t('sell.photoCount', { count: photos.length, max: maxPhotos })} · {t('sell.photoHint', { max: maxPhotos })}
                </span>
              </div>
            )}
          </div>
          {imageError && <span className="field__error">{imageError}</span>}
        </div>

        <Field label={t('sell.titleLabel')} error={errorFor('title')} required>
          {(props) => (
            <input
              {...props}
              className="input"
              value={values.title}
              onChange={set('title')}
              placeholder={t('sell.titlePlaceholder')}
              maxLength={120}
            />
          )}
        </Field>

        <div className="form-grid">
          <Field label={t('sell.categoryLabel')} error={errorFor('category')} required>
            {(props) => (
              <select {...props} value={values.category} onChange={set('category')}>
                <option value="">{t('sell.categoryPlaceholder')}</option>
                {meta.categories.map((value) => (
                  <option key={value} value={value}>{t(`categories.${value}`)}</option>
                ))}
              </select>
            )}
          </Field>

          <Field label={t('sell.priceLabel')} hint={t('sell.priceHint')} error={errorFor('price_vnd')} required>
            {(props) => (
              <input
                {...props}
                className="input"
                inputMode="numeric"
                value={values.price_vnd}
                onChange={set('price_vnd')}
                placeholder={t('sell.pricePlaceholder')}
              />
            )}
          </Field>

          <Field label={t('sell.districtLabel')} error={errorFor('district')} required>
            {(props) => (
              <select {...props} value={values.district} onChange={set('district')}>
                <option value="">{t('sell.districtPlaceholder')}</option>
                {meta.districts.map((value) => (
                  <option key={value} value={value}>{t(`districts.${value}`)}</option>
                ))}
              </select>
            )}
          </Field>

          <Field label={t('sell.conditionLabel')} error={errorFor('condition')} required>
            {(props) => (
              <select {...props} value={values.condition} onChange={set('condition')}>
                <option value="">{t('sell.conditionPlaceholder')}</option>
                {meta.conditions.map((value) => (
                  <option key={value} value={value}>{t(`conditions.${value}`)}</option>
                ))}
              </select>
            )}
          </Field>
        </div>

        <Field
          label={t('sell.descriptionLabel')}
          hint={t('sell.descriptionHint')}
          error={errorFor('description')}
          required
        >
          {(props) => (
            <textarea
              {...props}
              className="textarea"
              value={values.description}
              onChange={set('description')}
              placeholder={t('sell.descriptionPlaceholder')}
              maxLength={6000}
            />
          )}
        </Field>

        <div className="form-grid">
          <Field label={t('sell.sellerNameLabel')} error={errorFor('seller_name')} required>
            {(props) => (
              <input
                {...props}
                className="input"
                value={values.seller_name}
                onChange={set('seller_name')}
                placeholder={t('sell.sellerNamePlaceholder')}
                maxLength={80}
              />
            )}
          </Field>

          <Field
            label={t('sell.sellerPhoneLabel')}
            hint={t('sell.sellerPhoneHint')}
            error={errorFor('seller_phone')}
            required
          >
            {(props) => (
              <input
                {...props}
                className="input"
                type="tel"
                value={values.seller_phone}
                onChange={set('seller_phone')}
                placeholder={t('sell.sellerPhonePlaceholder')}
                maxLength={20}
              />
            )}
          </Field>
        </div>

        <Field
          label={t('sell.sellerEmailLabel')}
          hint={t('sell.sellerEmailHint')}
          error={errorFor('seller_email')}
          required
        >
          {(props) => (
            <input
              {...props}
              className="input"
              type="email"
              autoComplete="email"
              value={values.seller_email}
              readOnly
              placeholder={t('sell.sellerEmailPlaceholder')}
              maxLength={120}
            />
          )}
        </Field>

        <div className="sell-submit">
          <div>
            <strong>{meta.first_listing_free ? t('sell.freeSubmitSummary') : t('sell.submitSummary', { fee: feeLabel })}</strong>
            <span>{meta.first_listing_free ? t('sell.freeSubmitSummaryBody') : t('sell.submitSummaryBody')}</span>
            <span className="sell-submit__agree">
              {t('sell.agreePrefix')}
              <Link to="/rules" target="_blank">{legalTitle(lang, 'rules')}</Link>
              {t('sell.agreeJoin')}
              <Link to="/terms" target="_blank">{legalTitle(lang, 'terms')}</Link>
              {t('sell.agreeSuffix')}
            </span>
          </div>
          <button type="submit" className="btn btn--accent" disabled={submitting}>
          {submitting ? t('sell.submitting') : t(meta.first_listing_free ? 'sell.freeSubmit' : 'sell.submit')}
          </button>
        </div>
      </form>
    </div>
  );
}
