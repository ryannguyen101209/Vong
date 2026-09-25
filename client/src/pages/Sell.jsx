import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import { formatPrice, digitsOnly } from '../lib/format.js';
import { Field } from '../components/Field.jsx';
import { UploadIcon } from '../components/Icons.jsx';
import { ErrorState } from '../components/States.jsx';
import { useAuth } from '../lib/auth.jsx';

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

  const [meta, setMeta] = useState({ categories: [], districts: [], conditions: [], fee_vnd: null });
  const [values, setValues] = useState(EMPTY);
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [metaStatus, setMetaStatus] = useState('loading');
  const [metaAttempt, setMetaAttempt] = useState(0);

  useEffect(() => {
    if (profile) setValues((current) => ({ ...current, seller_name: current.seller_name || profile.name, seller_email: current.seller_email || profile.email }));
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

  // Object URLs have to be released or the tab leaks memory on every re-pick.
  useEffect(() => {
    if (!image) {
      setPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

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
    if (image) body.append('image', image);

    try {
      const created = await api.createListing(body);
      // Straight to payment: the listing is not public until the fee is paid.
      navigate(`/payment/${created.id}`, { replace: true });
    } catch (error) {
      if (error.payload?.fields) setErrors(error.payload.fields);
      else if (error.payload?.error === 'image_too_large') setErrors({ image: 'too_large' });
      else setErrors({ form: 'error' });
      setSubmitting(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const chooseImage = (file) => {
    setErrors((current) => {
      const { image: ignored, ...rest } = current;
      return rest;
    });
    if (!file) {
      setImage(null);
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrors((current) => ({ ...current, image: 'type' }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors((current) => ({ ...current, image: 'too_large' }));
      return;
    }
    setImage(file);
  };

  const onDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    chooseImage(event.dataTransfer.files?.[0]);
  };

  const feeLabel = meta.fee_vnd == null ? '…' : formatPrice(meta.fee_vnd, lang);
  const hasErrors = Object.keys(errors).length > 0;

  if (authLoading) return <div className="shell section"><p role="status">{t('common.loading')}</p></div>;
  if (!profile) return <div className="shell section messages-gate"><h1>{t('auth.sellTitle')}</h1><p className="lead">{t('auth.sellBody')}</p><button className="btn btn--primary" onClick={openSignIn}>{t('auth.signIn')}</button></div>;

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
          <span>{feeLabel}</span>
          <small>{t('common.perListing')}</small>
        </div>
      </header>

      <div className="notice notice--info fee-notice">
        <p className="notice__title">{t('sell.feeNoticeTitle', { fee: feeLabel })}</p>
        <p style={{ margin: 0 }}>{t('sell.feeNoticeBody')}</p>
      </div>

      {hasErrors && (
        <div className="notice notice--bad" style={{ marginBottom: 24 }} role="alert">
          <p className="notice__title">{t('sell.errorTitle')}</p>
          {errors.image === 'too_large' && <p style={{ margin: 0 }}>{t('sell.errorImage')}</p>}
          {errors.form && <p style={{ margin: 0 }}>{t('common.error')}</p>}
        </div>
      )}

      <form className="form sell-form" onSubmit={onSubmit} noValidate>
        <div className="field">
          <span className="field__label">{t('sell.photoLabel')}</span>
          <div
            className={`uploader${dragging ? ' is-dragging' : ''}${preview ? ' has-preview' : ''}`}
            onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
            onDrop={onDrop}
          >
            {preview ? (
              <div className="uploader__preview"><img src={preview} alt={t('sell.photoPreviewAlt')} /></div>
            ) : (
              <div className="uploader__drop-icon"><UploadIcon size={28} /></div>
            )}
            <div className="uploader__copy">
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => chooseImage(event.target.files?.[0])}
              />
              <strong>{image ? image.name : t('sell.photoDropTitle')}</strong>
              <span className="field__hint">{t('sell.photoHint')}</span>
              <div className="row">
                <button type="button" className="btn btn--small" onClick={() => fileInput.current?.click()}>
                  {image ? t('sell.photoChange') : t('sell.photoChoose')}
                </button>
                {image && (
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => {
                      setImage(null);
                      if (fileInput.current) fileInput.current.value = '';
                    }}
                  >
                    {t('sell.photoRemove')}
                  </button>
                )}
              </div>
            </div>
          </div>
          {errors.image && <span className="field__error">{errors.image === 'too_large' ? t('sell.errorImage') : t('sell.errorImageType')}</span>}
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
              onChange={set('seller_email')}
              placeholder={t('sell.sellerEmailPlaceholder')}
              maxLength={120}
            />
          )}
        </Field>

        <div className="sell-submit">
          <div>
            <strong>{t('sell.submitSummary', { fee: feeLabel })}</strong>
            <span>{t('sell.submitSummaryBody')}</span>
          </div>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting ? t('sell.submitting') : t('sell.submit')}
          </button>
        </div>
      </form>
    </div>
  );
}
