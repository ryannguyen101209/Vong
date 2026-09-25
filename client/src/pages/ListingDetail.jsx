import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import { formatPrice, formatDate } from '../lib/format.js';
import { ListingImage } from '../components/ListingCard.jsx';
import { SaveButton } from '../components/SaveButton.jsx';
import { EmptyState, ErrorState } from '../components/States.jsx';
import { ArrowLeftIcon, PhoneIcon, MessageIcon } from '../components/Icons.jsx';
import { useAuth } from '../lib/auth.jsx';

export function ListingDetail() {
  const { id } = useParams();
  const { t, lang, localized } = useI18n();
  const { profile, openSignIn } = useAuth();
  const [listing, setListing] = useState(null);
  const [status, setStatus] = useState('loading');
  const [contact, setContact] = useState(null);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    setStatus('loading');
    setContact(null);
    api
      .listing(id)
      .then((data) => {
        setListing(data.listing);
        setStatus('ready');
      })
      .catch((error) => setStatus(error.status === 404 ? 'missing' : 'error'));
  }, [id]);

  if (status === 'loading') {
    return <div className="shell section editorial-page listing-page"><p className="muted">{t('common.loading')}</p></div>;
  }
  if (status === 'missing') {
    return (
      <div className="shell section editorial-page listing-page">
        <EmptyState title={t('listing.notFoundTitle')} body={t('listing.notFoundBody')}>
          <Link to="/browse" className="btn">{t('nav.browse')}</Link>
        </EmptyState>
      </div>
    );
  }
  if (status === 'error') {
    return <div className="shell section editorial-page listing-page"><ErrorState /></div>;
  }

  const title = localized(listing, 'title');
  const description = localized(listing, 'description');
  const paragraphs = description.split(/\n\s*\n/).filter(Boolean);

  const requestToBuy = () => {
    if (!profile) { openSignIn(); return; }
    setRequesting(true);
    api
      .buyRequest(listing.id)
      .then(setContact)
      .catch(() => setContact({ error: true }))
      .finally(() => setRequesting(false));
  };

  return (
    <div className="shell section editorial-page listing-page">
      <Link to="/browse" className="link-quiet row" style={{ marginBottom: 24, gap: 6 }}>
        <ArrowLeftIcon /> {t('listing.backToBrowse')}
      </Link>

      {listing.status !== 'published' && (
        <div className="notice notice--warning" style={{ marginBottom: 24 }}>
          {t('listing.statusNotice', { status: t(`status.${listing.status}`) })}
        </div>
      )}

      <div className="detail">
        <div>
          <div className="detail__media">
            <ListingImage listing={listing} alt={title} />
          </div>

          <div className="card panel" style={{ marginTop: 28 }}>
            <h2 style={{ fontSize: '1.3rem' }}>{t('listing.descriptionTitle')}</h2>
            <div className="prose">
              {paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </div>
        </div>

        <aside className="detail__aside">
          <div className="card panel">
            <h1 style={{ fontSize: 'clamp(1.5rem, 3.2vw, 2rem)' }}>{title}</h1>
            <p className="detail__price" style={{ marginBottom: 20 }}>
              {formatPrice(listing.price_vnd, lang)}
            </p>

            <table className="spec-table">
              <tbody>
                <tr>
                  <th scope="row">{t('listing.category')}</th>
                  <td>{t(`categories.${listing.category}`)}</td>
                </tr>
                <tr>
                  <th scope="row">{t('listing.condition')}</th>
                  <td>{t(`conditions.${listing.condition}`)}</td>
                </tr>
                <tr>
                  <th scope="row">{t('listing.district')}</th>
                  <td>{t(`districts.${listing.district}`)}</td>
                </tr>
                <tr>
                  <th scope="row">{t('listing.posted')}</th>
                  <td>{formatDate(listing.published_at || listing.created_at, lang)}</td>
                </tr>
                <tr>
                  <th scope="row">{t('listing.views')}</th>
                  <td>{listing.views}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="card panel seller-card">
            <div className="seller-card__row">
              <span className="avatar" aria-hidden="true">
                {((listing.seller_name || '?').trim().split(/\s+/).pop() || '?')[0].toUpperCase()}
              </span>
              <div>
                <p className="small muted" style={{ margin: 0 }}>{t('listing.sellerTitle')}</p>
                <strong>{listing.seller_name}</strong>
              </div>
            </div>

            {profile && profile.id === listing.seller_id ? (
              <div className="notice notice--accent">
                <p className="notice__title">{t('listing.ownTitle')}</p>
                <p className="small" style={{ margin: '0 0 12px' }}>{t('listing.ownBody')}</p>
                <div className="row">
                  <Link to="/my-listings" className="btn btn--small">{t('mine.title')}</Link>
                  <Link to="/messages" className="btn btn--ghost btn--small">{t('nav.messages')}</Link>
                </div>
              </div>
            ) : contact?.seller_phone ? (
              <div className="notice notice--accent">
                <p className="notice__title">{t('listing.contactTitle', { name: contact.seller_name })}</p>
                <p className="contact-reveal row" style={{ gap: 8, margin: '6px 0 10px' }}>
                  <PhoneIcon /> <a href={`tel:${contact.seller_phone.replace(/\s/g, '')}`}>{contact.seller_phone}</a>
                </p>
                <p className="small" style={{ margin: 0 }}>{t('listing.contactBody')}</p>
              </div>
            ) : (
              <>
                <p className="small muted">{t('listing.sellerNote')}</p>
                <div className="seller-actions">
                  <Link
                    to={`/messages?listing=${listing.id}`}
                    className={`btn btn--accent${listing.status !== 'published' ? ' is-disabled' : ''}`}
                    aria-disabled={listing.status !== 'published'}
                    onClick={(event) => listing.status !== 'published' && event.preventDefault()}
                  >
                    <MessageIcon /> {t('listing.messageSeller')}
                  </Link>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={requestToBuy}
                    disabled={requesting || listing.status !== 'published'}
                  >
                    <PhoneIcon /> {requesting ? t('listing.requesting') : t('listing.requestPhone')}
                  </button>
                  <SaveButton listingId={listing.id} inline />
                </div>
              </>
            )}
          </div>

          <div className="notice payment-choice">
            <p className="notice__title">{t('listing.safetyTitle')}</p>
            <p className="small" style={{ margin: 0 }}>{t('listing.safetyBody')}</p>
            <div className="payment-choice__modes">
              <span>{t('listing.payInPerson')}</span>
              <span>{t('listing.payBankTransfer')}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
