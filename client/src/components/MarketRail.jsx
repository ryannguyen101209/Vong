import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { formatPrice } from '../lib/format.js';

/** The quiet column beside the feed: how selling works, categories, the one rule about money. */
export function MarketRail({ categories = [], fee = null }) {
  const { t, lang } = useI18n();
  const feeLabel = fee == null ? '…' : formatPrice(fee, lang);

  return (
    <aside className="rail" aria-label={t('market.sell')}>
      <section className="rail__block">
        <h2>{t('rail.sellTitle')}</h2>
        <p>{t('rail.sellBody', { fee: feeLabel })}</p>
        <Link className="btn btn--primary" to="/sell">{t('market.sell')}</Link>
      </section>

      {categories.length > 0 && (
        <nav className="rail__block" aria-label={t('market.categories')}>
          <h2>{t('market.categories')}</h2>
          <ul className="rail__list">
            {categories.map((category) => (
              <li key={category}>
                <Link to={`/browse?category=${encodeURIComponent(category)}`}>{t(`categories.${category}`)}</Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <p className="rail__note">{t('rail.note')}</p>
    </aside>
  );
}
