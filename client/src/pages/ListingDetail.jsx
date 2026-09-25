import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import { formatPrice, formatDate, formatRelative } from '../lib/format.js';
import { ListingImage } from '../components/ListingCard.jsx';
import { Avatar } from '../components/Avatar.jsx';
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
    return <div className="listing-page"><div className="shell listing"><p className="system-msg" role="status">{t('common.loading')}</p></div></div>;
  }
  if (status === 'missing') {
    return (
      <div className="shell page">
        <EmptyState title={t('listing.notFoundTitle')} body={t('listing.notFoundBody')}>
          <Link to="/browse" className="btn">{t('nav.browse')}</Link>
        </EmptyState>
      </div>
    );
  }
  if (status === 'error') {
    return <div className="shell page"><ErrorState /></div>;
  }

  const title = localized(listing, 'title');
  const description = localized(listing, 'description');
  const paragraphs = description.split(/\n\s*\n/).filter(Boolean);
  const posted = listing.published_at || listing.created_at;
  const published = listing.status === 'published';
  const own = profile && profile.id === listing.seller_id;

  const showPhone = () => {
    if (!profile) { openSignIn(); return; }
    setRequesting(true);
    api
      .buyRequest(listing.id)
      .then(setContact)
      .catch(() => setContact({ error: true }))
      .finally(() => setRequesting(false));
  };

  const actions = (
    <>
      {own ? (
        <>
          <p className="listing__own">{t('listing.ownBody')}</p>
          <div className="row">
            <Link to="/my-listings" className="btn btn--small">{t('mine.title')}</Link>
            <Link to="/messages" className="btn btn--small">{t('nav.messages')}</Link>
          </div>
        </>
      ) : contact?.seller_phone ? (
        <p className="listing__phone">
          <PhoneIcon /> <a href={`tel:${contact.seller_phone.replace(/\s/g, '')}`}>{contact.seller_phone}</a>
          <span>{t('listing.contactBody')}</span>
        </p>
      ) : (
        <>
          <Link
            to={`/messages?listing=${listing.id}`}
            className={`btn btn--primary listing__message${published ? '' : ' is-disabled'}`}
            aria-disabled={!published}
            onClick={(event) => !published && event.preventDefault()}
          >
            <MessageIcon /> {t('listing.messageSellerNamed', { name: listing.seller_name })}
          </Link>
          <button type="button" className="btn" onClick={showPhone} disabled={requesting || !published}>
            <PhoneIcon /> {requesting ? t('listing.requesting') : t('listing.requestPhone')}
          </button>
          <SaveButton listingId={listing.id} inline />
          {contact?.error && <p className="field__error" role="alert">{t('common.error')}</p>}
        </>
      )}
    </>
  );

  return (
    <div className="listing-page">
      <div className="shell listing">
        <Link to="/browse" className="listing__back">
          <ArrowLeftIcon /> {t('listing.backToBrowse')}
        </Link>

        {!published && (
          <p className="notice notice--wait">{t('listing.statusNotice', { status: t(`status.${listing.status}`) })}</p>
        )}

        <article className="listing__post" aria-labelledby="listing-title">
          <div className="post__meta listing__author">
            <Avatar name={listing.seller_name} size="lg" />
            <div>
              <strong>{listing.seller_name}</strong>
              <span>{t(`districts.${listing.district}`)} · <time dateTime={posted}>{formatRelative(posted, lang)}</time></span>
            </div>
          </div>

          <div className="bubble listing__bubble">
            <div className="listing__photo">
              <ListingImage listing={listing} alt={title} />
            </div>
            <div className="listing__text">
              <h1 id="listing-title">{title}</h1>
              <p className="listing__price">{formatPrice(listing.price_vnd, lang)}</p>
              <div className="listing__actions">{actions}</div>
              <dl className="listing__facts">
                <div><dt>{t('listing.condition')}</dt><dd>{t(`conditions.${listing.condition}`)}</dd></div>
                <div><dt>{t('listing.category')}</dt><dd>{t(`categories.${listing.category}`)}</dd></div>
                <div><dt>{t('listing.district')}</dt><dd>{t(`districts.${listing.district}`)}</dd></div>
                <div><dt>{t('listing.posted')}</dt><dd>{formatDate(posted, lang)}</dd></div>
              </dl>
              <div className="listing__desc">
                {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
              </div>
            </div>
          </div>

          <p className="system-msg listing__safety">{t('listing.safetyBody')}</p>
        </article>
      </div>

      <div className="listing__reply" role="region" aria-label={t('listing.sellerTitle')}>
        <div className="shell listing__reply-inner">
          {actions}
        </div>
      </div>
    </div>
  );
}
