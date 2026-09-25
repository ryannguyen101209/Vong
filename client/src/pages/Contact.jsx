import { useEffect, useRef, useState } from 'react';
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
  const sentRef = useRef(null);

  // The form is replaced by the confirmation, so move focus onto it.
  useEffect(() => {
    if (sent) sentRef.current?.focus();
  }, [sent]);

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
      // Field problems go next to their fields; anything else is a failed send.
      setErrors(error.payload?.fields ?? { form: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="info">
      <div className="shell info__col info__col--wide">
        <div className="info__head">
          <h1>{t('contact.title')}</h1>
          <p>{t('contact.intro')}</p>
        </div>

        <div className="contact">
          <div className="contact__main">
            {sent ? (
              <div className="contact__sent">
                <div className="notice notice--ok" role="status" tabIndex={-1} ref={sentRef}>
                  <p className="notice__title contact__sent-title"><CheckIcon /> {t('contact.sentTitle')}</p>
                  <p>{t('contact.sentBody')}</p>
                </div>
                <button type="button" className="btn" onClick={() => setSent(false)}>
                  {t('contact.sentAnother')}
                </button>
              </div>
            ) : (
              <form className="form contact__form" onSubmit={onSubmit} noValidate>
                {errors.form && <p className="notice notice--bad" role="alert">{t('common.error')}</p>}
                <div className="form-grid">
                  <Field label={t('contact.nameLabel')} error={errorFor('name')} required>
                    {(props) => (
                      <input {...props} className="input" autoComplete="name" value={values.name} onChange={set('name')} maxLength={80} />
                    )}
                  </Field>

                  <Field label={t('contact.emailLabel')} error={errorFor('email')} required>
                    {(props) => (
                      <input {...props} className="input" type="email" autoComplete="email" value={values.email} onChange={set('email')} />
                    )}
                  </Field>
                </div>

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

                <button type="submit" className="btn btn--primary contact__submit" disabled={submitting}>
                  {submitting ? t('contact.submitting') : t('contact.submit')}
                </button>
              </form>
            )}
          </div>

          <aside className="contact__ways" aria-labelledby="contact-ways">
            <h2 id="contact-ways">{t('contact.otherWaysTitle')}</h2>
            <dl>
              <div>
                <dt>{t('contact.zaloLabel')}</dt>
                <dd className="contact__zalo">{SITE.zalo}</dd>
              </div>
              <div>
                <dt>{t('contact.emailUsLabel')}</dt>
                <dd><a href={`mailto:${SITE.email}`}>{SITE.email}</a></dd>
              </div>
              <div>
                <dt>{t('contact.hoursLabel')}</dt>
                <dd>{t('contact.replyHours')}</dd>
              </div>
            </dl>
          </aside>
        </div>
      </div>
    </div>
  );
}
