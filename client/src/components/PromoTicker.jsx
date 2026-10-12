import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';

/**
 * The thin bar above the header: short lines that slide slowly to the left in a
 * continuous loop. The track holds the lines twice, so moving it by half its
 * width brings the second copy exactly where the first began, with no seam.
 * Pauses on hover or keyboard focus; holds still for people who prefer less motion.
 */
export function PromoTicker() {
  const { t, tList } = useI18n();
  const items = tList('ticker.items');
  if (!items.length) return null;

  const run = (copy) =>
    items.map((item, i) => (
      <li key={`${copy}-${i}`} className="ticker__item" aria-hidden={copy === 1 ? true : undefined}>
        <Link to={item.to} tabIndex={copy === 1 ? -1 : undefined}>{item.text}</Link>
        <span className="ticker__sep" aria-hidden="true">✦</span>
      </li>
    ));

  return (
    <div className="ticker" role="region" aria-label={t('ticker.label')}>
      <ul className="ticker__track">
        {run(0)}
        {run(1)}
      </ul>
    </div>
  );
}
