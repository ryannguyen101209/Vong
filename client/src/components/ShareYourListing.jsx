import { useI18n } from '../i18n/index.jsx';
import { ShareButton } from './ShareButton.jsx';

/** Shown to a seller on their own live listing: the quickest way to more buyers is to share it. */
export function ShareYourListing({ url, title, text }) {
  const { t } = useI18n();
  const facebook = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  return (
    <div className="card panel share-own">
      <p className="notice__title" style={{ marginBottom: 4 }}>{t('listing.shareOwnTitle')}</p>
      <p className="small muted" style={{ margin: '0 0 14px' }}>{t('listing.shareOwnBody')}</p>
      <div className="share-own__actions">
        <a className="btn btn--accent" href={facebook} target="_blank" rel="noopener">{t('listing.shareFacebook')}</a>
        <ShareButton url={url} title={title} text={text} />
      </div>
    </div>
  );
}
