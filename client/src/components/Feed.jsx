import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { useAuth } from '../lib/auth.jsx';
import { formatDate } from '../lib/format.js';
import { ListingPost } from './ListingCard.jsx';
import { Avatar } from './Avatar.jsx';
import { LogoMark } from './Logo.jsx';

/** "Today", "Yesterday" or the date, the way a chat groups messages by day. */
function dayLabel(iso, lang, t) {
  const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(new Date(iso))) / 86400000);
  if (days === 0) return t('feed.today');
  if (days === 1) return t('feed.yesterday');
  return formatDate(iso, lang);
}

/** Listing posts, with a day divider wherever the day changes (newest-first feeds only). */
export function Feed({ listings, byDay = true }) {
  const { t, lang } = useI18n();
  const items = [];
  let lastDay = null;
  for (const listing of listings) {
    if (byDay) {
      const day = dayLabel(listing.published_at || listing.created_at, lang, t);
      if (day !== lastDay) {
        items.push(<li className="feed__day" key={`day-${day}`}><span className="system-msg">{day}</span></li>);
        lastDay = day;
      }
    }
    items.push(<ListingPost listing={listing} key={listing.id} />);
  }
  return <ol className="feed">{items}</ol>;
}

/** The top of the thread: where you start a post, as in any group chat. */
export function FeedComposer() {
  const { t } = useI18n();
  const { profile } = useAuth();
  return (
    <Link to="/sell" className="feed-composer">
      {profile
        ? <Avatar name={profile.name} picture={profile.picture} />
        : <span className="avatar feed-composer__mark" aria-hidden="true"><LogoMark size={18} /></span>}
      <span className="feed-composer__field">{t('feed.composer')}</span>
      <span className="btn btn--primary btn--small" aria-hidden="true">{t('feed.post')}</span>
    </Link>
  );
}
