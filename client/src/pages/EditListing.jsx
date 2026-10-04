import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';
import { digitsOnly } from '../lib/format.js';
import { Field } from '../components/Field.jsx';
import { ErrorState } from '../components/States.jsx';

export function EditListing() {
  const { id } = useParams();
  const { t, localized } = useI18n();
  const { profile, loading, openSignIn } = useAuth();
  const navigate = useNavigate();
  const [meta, setMeta] = useState({ categories: [], districts: [], conditions: [] });
  const [values, setValues] = useState(null);
  const [status, setStatus] = useState('loading');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    if (!profile) return undefined;
    let active = true;
    setStatus('loading');
    Promise.all([api.meta(), api.myListings()])
      .then(([metaData, mine]) => {
        if (!active) return;
        const listing = mine.listings.find((item) => item.id === id);
        if (!listing) { setStatus('missing'); return; }
        setMeta(metaData);
        setValues({
          title: localized(listing, 'title') || '',
          description: localized(listing, 'description') || '',
          category: listing.category,
          price_vnd: String(listing.price_vnd),
          district: listing.district,
          condition: listing.condition,
          seller_name: listing.seller_name,
          seller_phone: listing.seller_phone || '',
        });
        setStatus('ready');
      })
      .catch(() => active && setStatus('error'));
    return () => { active = false; };
  }, [id, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="shell section"><p role="status">{t('common.loading')}</p></div>;
  if (!profile) {
    return (
      <div className="shell section messages-gate">
        <h1>{t('myListings.signInTitle')}</h1>
        <p className="lead">{t('myListings.signInBody')}</p>
        <button className="btn btn--accent" onClick={openSignIn}>{t('auth.signIn')}</button>
      </div>
    );
  }
  if (status === 'loading') return <div className="shell section"><p role="status">{t('common.loading')}</p></div>;
  if (status === 'missing') {
    return (
      <div className="shell section editorial-page">
        <h1>{t('myListings.editMissing')}</h1>
        <Link to="/my-listings" className="btn btn--ghost">{t('myListings.title')}</Link>
      </div>
    );
  }
  if (status === 'error') return <div className="shell section"><ErrorState onRetry={() => setStatus('loading')} /></div>;

  const set = (key) => (event) => {
    const value = key === 'price_vnd' ? digitsOnly(event.target.value) : event.target.value;
    setValues((current) => ({ ...current, [key]: value }));
  };
  const errorFor = (key) => {
    const code = errors[key];
    if (!code) return undefined;
    if (key === 'seller_phone') return t('sell.errorPhone');
    if (key === 'price_vnd') return t('sell.errorPrice');
    return code === 'invalid' ? t('sell.errorInvalid') : t('sell.errorLength');
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    setSaveError(false);
    try {
      await api.updateListing(id, values);
      navigate('/my-listings');
    } catch (error) {
      if (error.payload?.fields) setErrors(error.payload.fields);
      else setSaveError(true);
      setSaving(false);
    }
  };

  return (
    <div className="shell section sell-page editorial-page">
      <Link to="/my-listings" className="link-quiet" style={{ display: 'inline-block', marginBottom: 20 }}>{t('myListings.title')}</Link>
      <h1>{t('myListings.editTitle')}</h1>
      <p className="lead">{t('myListings.editLead')}</p>

      {(saveError || Object.keys(errors).length > 0) && (
        <div className="notice notice--danger" role="alert" style={{ marginBottom: 24 }}>
          <p className="notice__title">{t('sell.errorTitle')}</p>
        </div>
      )}

      <form className="form sell-form" onSubmit={onSubmit} noValidate>
        <Field label={t('sell.titleLabel')} error={errorFor('title')} required>
          {(props) => <input {...props} className="input" value={values.title} onChange={set('title')} maxLength={120} />}
        </Field>

        <div className="form-grid">
          <Field label={t('sell.categoryLabel')} error={errorFor('category')} required>
            {(props) => (
              <select {...props} value={values.category} onChange={set('category')}>
                {meta.categories.map((value) => <option key={value} value={value}>{t(`categories.${value}`)}</option>)}
              </select>
            )}
          </Field>
          <Field label={t('sell.priceLabel')} hint={t('sell.priceHint')} error={errorFor('price_vnd')} required>
            {(props) => <input {...props} className="input" inputMode="numeric" value={values.price_vnd} onChange={set('price_vnd')} />}
          </Field>
          <Field label={t('sell.districtLabel')} error={errorFor('district')} required>
            {(props) => (
              <select {...props} value={values.district} onChange={set('district')}>
                {meta.districts.map((value) => <option key={value} value={value}>{t(`districts.${value}`)}</option>)}
              </select>
            )}
          </Field>
          <Field label={t('sell.conditionLabel')} error={errorFor('condition')} required>
            {(props) => (
              <select {...props} value={values.condition} onChange={set('condition')}>
                {meta.conditions.map((value) => <option key={value} value={value}>{t(`conditions.${value}`)}</option>)}
              </select>
            )}
          </Field>
        </div>

        <Field label={t('sell.descriptionLabel')} hint={t('sell.descriptionHint')} error={errorFor('description')} required>
          {(props) => <textarea {...props} className="textarea" value={values.description} onChange={set('description')} maxLength={6000} />}
        </Field>

        <div className="form-grid">
          <Field label={t('sell.sellerNameLabel')} error={errorFor('seller_name')} required>
            {(props) => <input {...props} className="input" value={values.seller_name} onChange={set('seller_name')} maxLength={80} />}
          </Field>
          <Field label={t('sell.sellerPhoneLabel')} hint={t('sell.sellerPhoneHint')} error={errorFor('seller_phone')} required>
            {(props) => <input {...props} className="input" type="tel" value={values.seller_phone} onChange={set('seller_phone')} maxLength={20} />}
          </Field>
        </div>

        <p className="small muted">{t('myListings.photosNote')}</p>
        <div className="row" style={{ gap: 12 }}>
          <button type="submit" className="btn btn--accent" disabled={saving}>{saving ? t('myListings.saving') : t('myListings.save')}</button>
          <Link to="/my-listings" className="btn btn--ghost">{t('myListings.cancel')}</Link>
        </div>
      </form>
    </div>
  );
}
