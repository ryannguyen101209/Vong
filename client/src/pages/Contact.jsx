import { useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import { SITE } from '../lib/site.js';
import { Field } from '../components/Field.jsx';
import { CheckIcon } from '../components/Icons.jsx';

const EMPTY = { name: '', email: '', message: '' };

export function Contact() {
  const { t } = useI18n();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const set = (key) => (event) => setValues((current) => ({ ...current, [key]: event.target.value }));

  const errorFor = (key) => {
    if (!errors[key]) return undefined;
    if (key === 'email') return t('contact.errorEmail');
    if (key === 'name') return t('contact.errorName');
    return t('contact.errorMessage');
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    try {
      await api.contact(values);
      setSent(true);
      setValues(EMPTY);
    } catch (error) {
      setErrors(error.payload?.fields ?? { message: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="shell section editorial-page contact-page">
      <div className="section-head">
        <h1>{t('contact.title')}</h1>
        <p className="lead">{t('contact.lead')}</p>
      </div>

      <div className="detail" style={{ gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 0.7fr)' }}>
        <div className="card panel">
          {sent ? (
            <div className="stack">
              <p className="eyebrow row" style={{ gap: 6 }}><CheckIcon /> {t('contact.sentTitle')}</p>
              <p>{t('contact.sentBody')}</p>
              <div>
                <button type="button" className="btn btn--ghost" onClick={() => setSent(false)}>
                  {t('contact.sentAnother')}
                </button>
              </div>
            </div>
          ) : (
            <form className="form" onSubmit={onSubmit} noValidate>
              <Field label={t('contact.nameLabel')} error={errorFor('name')} required>
                {(props) => (
                  <input {...props} className="input" value={values.name} onChange={set('name')} maxLength={80} />
                )}
              </Field>

              <Field label={t('contact.emailLabel')} error={errorFor('email')} required>
                {(props) => (
                  <input {...props} className="input" type="email" value={values.email} onChange={set('email')} />
                )}
              </Field>

              <Field label={t('contact.messageLabel')} error={errorFor('message')} required>
                {(props) => (
                  <textarea
                    {...props}
                    className="textarea"
                    value={values.message}
                    onChange={set('message')}
                    placeholder={t('contact.messagePlaceholder')}
                    maxLength={4000}
                  />
                )}
              </Field>

              <button type="submit" className="btn btn--accent" disabled={submitting}>
                {submitting ? t('contact.submitting') : t('contact.submit')}
              </button>
            </form>
          )}
        </div>

        <aside className="card panel">
          <p className="eyebrow">{t('contact.otherWaysTitle')}</p>
          <div className="detail-rows">
            <div className="detail-row">
              <span className="detail-row__label">{t('contact.zaloLabel')}</span>
              <span className="detail-row__value">{SITE.zalo}</span>
            </div>
            <div className="detail-row">
              <span className="detail-row__label">{t('contact.emailUsLabel')}</span>
              <span className="detail-row__value">
                <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-row__label">{t('contact.hoursLabel')}</span>
              <span className="detail-row__value">{t('contact.hoursValue')}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
