import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import { formatPrice, digitsOnly } from '../lib/format.js';
import { Field } from '../components/Field.jsx';
import { BoxIcon } from '../components/Icons.jsx';

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
  const navigate = useNavigate();
  const fileInput = useRef(null);

  const [meta, setMeta] = useState({ categories: [], districts: [], conditions: [], fee_vnd: null });
  const [values, setValues] = useState(EMPTY);
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.meta().then(setMeta).catch(() => {});
  }, []);

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

  const feeLabel = meta.fee_vnd == null ? '…' : formatPrice(meta.fee_vnd, lang);
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <div className="shell section" style={{ maxWidth: 820 }}>
      <div className="section-head">
        <h1>{t('sell.title')}</h1>
        <p className="lead">{t('sell.lead')}</p>
      </div>

      <div className="notice notice--accent" style={{ marginBottom: 28 }}>
        <p className="notice__title">{t('sell.feeNoticeTitle', { fee: feeLabel })}</p>
        <p style={{ margin: 0 }}>{t('sell.feeNoticeBody')}</p>
      </div>

      {hasErrors && (
        <div className="notice notice--danger" style={{ marginBottom: 24 }} role="alert">
          <p className="notice__title">{t('sell.errorTitle')}</p>
          {errors.image === 'too_large' && <p style={{ margin: 0 }}>{t('sell.errorImage')}</p>}
          {errors.form && <p style={{ margin: 0 }}>{t('common.error')}</p>}
        </div>
      )}

      <form className="form" onSubmit={onSubmit} noValidate>
        <div className="field">
          <span className="field__label">{t('sell.photoLabel')}</span>
          <div className="uploader">
            <div className="uploader__preview">
              {preview ? (
                <img src={preview} alt="" />
              ) : (
                <span className="muted" style={{ opacity: 0.5 }}><BoxIcon size={38} /></span>
              )}
            </div>
            <div className="stack" style={{ gap: 8 }}>
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                onChange={(event) => setImage(event.target.files?.[0] ?? null)}
              />
              <div className="row">
                <button type="button" className="btn btn--ghost btn--small" onClick={() => fileInput.current?.click()}>
                  {image ? t('sell.photoChange') : t('sell.photoChoose')}
                </button>
                {image && (
                  <button
                    type="button"
                    className="link-quiet"
                    onClick={() => {
                      setImage(null);
                      if (fileInput.current) fileInput.current.value = '';
                    }}
                  >
                    {t('sell.photoRemove')}
                  </button>
                )}
              </div>
              <span className="field__hint">{t('sell.photoHint')}</span>
            </div>
          </div>
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

        <button type="submit" className="btn btn--accent btn--block" disabled={submitting}>
          {submitting ? t('sell.submitting') : t('sell.submit')}
        </button>
      </form>
    </div>
  );
}
