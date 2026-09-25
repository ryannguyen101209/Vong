import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import { formatPrice, digitsOnly } from '../lib/format.js';
import { Field } from '../components/Field.jsx';
import { Avatar } from '../components/Avatar.jsx';
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

  if (authLoading) return <div className="shell page"><p className="system-msg" role="status">{t('common.loading')}</p></div>;
  if (!profile) {
    return (
      <div className="shell gate">
        <h1>{t('auth.sellTitle')}</h1>
        <p>{t('auth.sellBody')}</p>
        <button type="button" className="btn btn--primary" onClick={openSignIn}>{t('auth.signIn')}</button>
      </div>
    );
  }

  const head = (
    <div className="sell__top">
      <div className="shell sell__col">
        <h1>{t('sell.title')}</h1>
        <p>{t('sell.intro')}</p>
      </div>
    </div>
  );

  if (metaStatus !== 'ready') {
    return (
      <div className="sell">
        {head}
        <div className="sell__thread">
          <div className="shell sell__col">
            {metaStatus === 'error'
              ? <ErrorState onRetry={() => setMetaAttempt((value) => value + 1)} />
              : <p className="system-msg" role="status">{t('common.loading')}</p>}
          </div>
        </div>
      </div>
    );
  }

  const author = values.seller_name.trim() || profile.name;

  return (
    <div className="sell">
      {head}

      <div className="sell__thread">
        <div className="shell sell__col">
          <p className="system-msg sell__fee">{t('sell.feeLine', { fee: feeLabel })}</p>

          {hasErrors && (
            <div className="notice notice--bad sell__alert" role="alert">
              <p className="notice__title">{t('sell.errorTitle')}</p>
              {errors.image === 'too_large' && <p>{t('sell.errorImageSize')}</p>}
              {errors.form && <p>{t('common.error')}</p>}
            </div>
          )}

          <form className="sell__form" onSubmit={onSubmit} noValidate>
            {/* How the post will read in the feed: your name, then the district once chosen. */}
            <div className="sell__author" aria-hidden="true">
              <Avatar name={author} picture={profile.picture} />
              <p className="post__meta">
                <strong>{author}</strong>
                {values.district && <span>{t(`districts.${values.district}`)}</span>}
              </p>
            </div>

            <div className="bubble sell__bubble">
              <div className="sell-photo" role="group" aria-labelledby="sell-photo-label">
                <span id="sell-photo-label" className="sr-only">{t('sell.photoLabel')}</span>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  tabIndex={-1}
                  onChange={(event) => chooseImage(event.target.files?.[0])}
                />
                <div
                  className={`sell-photo__frame${dragging ? ' is-dragging' : ''}${preview ? ' has-preview' : ''}`}
                  onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
                  onDrop={onDrop}
                >
                  {preview ? (
                    <img src={preview} alt={t('sell.photoPreviewAlt')} />
                  ) : (
                    // The empty frame opens the picker too; the button below is the keyboard path.
                    <div className="sell-photo__empty" onClick={() => fileInput.current?.click()}>
                      <UploadIcon size={26} />
                      <p className="sell-photo__drop">{t('sell.photoDropTitle')}</p>
                      <p className="sell-photo__hint">{t('sell.photoHint')}</p>
                    </div>
                  )}
                </div>
                <div className="sell-photo__bar">
                  {image && <span className="sell-photo__name">{image.name}</span>}
                  <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
                    {image ? t('sell.photoChange') : t('sell.photoChoose')}
                  </button>
                  {image && (
                    <button
                      type="button"
                      className="link-btn sell-photo__remove"
                      onClick={() => {
                        setImage(null);
                        if (fileInput.current) fileInput.current.value = '';
                      }}
                    >
                      {t('sell.photoRemove')}
                    </button>
                  )}
                </div>
                {errors.image && (
                  <p className="field__error sell-photo__error">
                    {errors.image === 'too_large' ? t('sell.errorImageSize') : t('sell.errorImageType')}
                  </p>
                )}
              </div>

              <div className="sell__rows">
                <Field label={t('sell.titleLabel')} error={errorFor('title')} required>
                  {(props) => (
                    <input
                      {...props}
                      className="input sell__title-input"
                      value={values.title}
                      onChange={set('title')}
                      placeholder={t('sell.titlePlaceholder')}
                      maxLength={120}
                    />
                  )}
                </Field>

                <Field label={t('sell.priceLabel')} hint={t('sell.priceNote')} error={errorFor('price_vnd')} required>
                  {(props) => (
                    <input
                      {...props}
                      className="input sell__price-input"
                      inputMode="numeric"
                      value={values.price_vnd}
                      onChange={set('price_vnd')}
                      placeholder={t('sell.pricePlaceholder')}
                    />
                  )}
                </Field>

                <div className="sell__split sell__split--3">
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
                      className="textarea sell__desc-input"
                      value={values.description}
                      onChange={set('description')}
                      placeholder={t('sell.descriptionPlaceholder')}
                      maxLength={6000}
                    />
                  )}
                </Field>
              </div>
            </div>

            <section className="bubble sell__bubble sell__bubble--you" aria-labelledby="sell-you-title">
              <h2 id="sell-you-title" className="sell__bubble-title">{t('sell.contactTitle')}</h2>
              <div className="sell__rows">
                <div className="sell__split">
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
              </div>
            </section>

            <div className="sell__send">
              <p className="sell__send-note">
                <strong>{t('sell.submitSummary', { fee: feeLabel })}</strong>
                <span>{t('sell.submitSummaryBody')}</span>
              </p>
              <button type="submit" className="btn btn--primary sell__submit" disabled={submitting}>
                {submitting ? t('sell.submitting') : t('sell.submit')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
