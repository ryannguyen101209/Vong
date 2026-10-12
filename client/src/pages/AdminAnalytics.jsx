import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import { formatPrice, formatDate } from '../lib/format.js';

const METRICS = ['listings', 'users', 'buy_requests', 'chat_messages'];
const METRIC_LABEL = {
  listings: 'metricListings',
  users: 'metricUsers',
  buy_requests: 'metricBuyRequests',
  chat_messages: 'metricChats',
};
const STATUSES = [
  ['pending_payment', 'var(--line-strong)'],
  ['awaiting_approval', 'var(--warning)'],
  ['published', 'var(--positive)'],
  ['rejected', 'var(--danger)'],
  ['removed', 'var(--ink-faint)'],
];

function niceMax(value) {
  if (value <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(value));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= value) return m * p;
  return 10 * p;
}

/** Saigon-time month key, e.g. "2026-10". */
const thisMonth = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 7);

function Stat({ label, value, sub }) {
  return (
    <div className="card an-stat">
      <div className="an-stat__label">{label}</div>
      <div className="an-stat__value">{value}</div>
      {sub && <div className="an-stat__sub">{sub}</div>}
    </div>
  );
}

function DailyChart({ days, metric, label }) {
  const values = days.map((d) => d[metric] || 0);
  const total = values.reduce((a, b) => a + b, 0);
  const max = niceMax(Math.max(0, ...values));
  const W = 640, H = 220, L = 30, R = 6, T = 10, B = 26;
  const iw = W - L - R, ih = H - T - B;
  const slot = iw / Math.max(days.length, 1);
  const bw = Math.max(3, slot * 0.62);
  const y = (v) => T + ih - (v / max) * ih;

  return (
    <>
      <p style={{ margin: '0 0 6px' }}>
        <strong style={{ fontSize: '1.4rem' }}>{total}</strong>{' '}
        <span className="small muted">{label}</span>
      </p>
      <svg className="an-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${total} ${label}`}>
        {[0, 1, 2, 3, 4].map((i) => {
          const v = (max / 4) * i;
          return (
            <g key={i}>
              <line className="grid" x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
              <text x={L - 8} y={y(v) + 4} textAnchor="end">{Number.isInteger(v) ? v : v.toFixed(1)}</text>
            </g>
          );
        })}
        {days.map((d, i) => {
          const v = values[i];
          const h = Math.max(2, (v / max) * ih);
          const cls = v === 0 ? 'bar bar--zero' : i === days.length - 1 ? 'bar bar--today' : 'bar';
          const x = L + i * slot + (slot - bw) / 2;
          const dayLabel = new Date(`${d.day}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
          return (
            <g key={d.day}>
              <rect className={cls} x={x} y={T + ih - h} width={bw} height={h} rx="1.5">
                <title>{`${dayLabel}: ${v}`}</title>
              </rect>
              {((i % 7 === 0 && days.length - 1 - i >= 4) || i === days.length - 1) && (
                <text x={L + i * slot + slot / 2} y={H - 8} textAnchor="middle">{dayLabel}</text>
              )}
            </g>
          );
        })}
      </svg>
    </>
  );
}

/** Monthly rows in time order, with a zero row for any month in between that earned nothing. */
function monthSeries(monthly) {
  const rows = [...monthly].sort((x, y) => x.month.localeCompare(y.month));
  if (!rows.length) return [];
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  const out = [];
  let [y, m] = rows[0].month.split('-').map(Number);
  const [endY, endM] = rows[rows.length - 1].month.split('-').map(Number);
  while (y < endY || (y === endY && m <= endM)) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    out.push(byMonth.get(key) || { month: key, fees_vnd: 0, listings: 0, free_listings: 0 });
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

/** Axis with four even steps that land on round numbers (10k, 20k, 25k, 50k...). */
function niceScale(value) {
  const raw = value / 4;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw);
  return { step, max: step * 4 };
}

const compact = (v) => (v >= 1e6 ? `${+(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `${+(v / 1e3).toFixed(1)}k` : String(v));

/** Line chart of fees earned per month. One series, so no legend: the section title names it. */
function MonthlyChart({ months, lang, locale, labels }) {
  const [hover, setHover] = useState(null);
  const [W, setW] = useState(640); // drawn at the card's real width, so text stays readable on a phone
  const wrapRef = useRef(null);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => setW(Math.max(260, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const n = months.length;
  const values = months.map((m) => m.fees_vnd || 0);
  const { max, step } = niceScale(Math.max(10000, ...values));
  const H = 240, L = 46, R = 18, T = 28, B = 28, PAD = 16;
  const iw = W - L - R, ih = H - T - B;
  const x = (i) => (n === 1 ? L + iw / 2 : L + PAD + (i / (n - 1)) * (iw - 2 * PAD));
  const y = (v) => T + ih - (v / max) * ih;
  const slotPx = n > 1 ? (iw - 2 * PAD) / (n - 1) : iw;
  const every = slotPx >= 58 ? 1 : slotPx >= 29 ? 2 : 3; // thin out month labels so they never collide
  // Same options for every label so the form never switches (e.g. "thg 10" vs "Tháng 11" in Vietnamese).
  const monthName = (key) => {
    const [yy, mm] = key.split('-').map(Number);
    return new Date(Date.UTC(yy, mm - 1, 1)).toLocaleDateString(locale, { month: 'short', year: '2-digit', timeZone: 'UTC' });
  };
  const longName = (key) => {
    const [yy, mm] = key.split('-').map(Number);
    return new Date(Date.UTC(yy, mm - 1, 1)).toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  };

  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last = n - 1;
  const summary = `${labels.title}: ${months.map((m, i) => `${longName(m.month)} ${formatPrice(values[i], lang)}`).join(', ')}`;

  const nearest = (clientX, svg) => {
    const box = svg.getBoundingClientRect();
    const px = ((clientX - box.left) / box.width) * W;
    let best = 0, dist = Infinity;
    for (let i = 0; i < n; i += 1) {
      const d = Math.abs(x(i) - px);
      if (d < dist) { dist = d; best = i; }
    }
    return best;
  };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); setHover((h) => Math.min(n - 1, (h ?? -1) + 1)); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); setHover((h) => Math.max(0, (h ?? n) - 1)); }
    if (e.key === 'Escape') setHover(null);
  };

  const tipPct = hover === null ? 0 : (x(hover) / W) * 100;
  const tipRight = tipPct > 55; // flip to the left of the crosshair near the right edge

  return (
    <div className="an-chart-wrap" ref={wrapRef}>
      <svg
        className="an-chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={summary}
        tabIndex={0}
        onPointerMove={(e) => setHover(nearest(e.clientX, e.currentTarget))}
        onPointerLeave={() => setHover(null)}
        onFocus={() => setHover((h) => h ?? last)}
        onBlur={() => setHover(null)}
        onKeyDown={onKeyDown}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <line className="grid" x1={L} x2={W - R} y1={y(step * i)} y2={y(step * i)} />
            <text x={L - 8} y={y(step * i) + 4} textAnchor="end">{compact(step * i)}</text>
          </g>
        ))}
        {months.map((m, i) => ((n - 1 - i) % every === 0) && (
          <text key={m.month} x={x(i)} y={H - 8} textAnchor="middle">{monthName(m.month)}</text>
        ))}
        {hover !== null && <line className="cross" x1={x(hover)} x2={x(hover)} y1={T} y2={T + ih} />}
        {n > 1 && <polyline className="line" points={points} />}
        {values.map((v, i) => (
          <circle key={months[i].month} className={`dot${hover === i ? ' dot--active' : ''}`} cx={x(i)} cy={y(v)} r={hover === i ? 5.5 : 4.5} />
        ))}
        {hover === null && (
          <text className="an-chart__value" x={x(last)} y={y(values[last]) - 12} textAnchor={n === 1 ? 'middle' : 'end'}>
            {formatPrice(values[last], lang)}
          </text>
        )}
      </svg>
      {hover !== null && (
        <div className={`an-tip${tipRight ? ' an-tip--left' : ''}`} style={{ left: `${tipPct}%` }} role="status">
          <div className="an-tip__label">{longName(months[hover].month)}</div>
          <div className="an-tip__row">
            <i className="an-tip__key" />
            <strong className="an-tip__value">{formatPrice(values[hover], lang)}</strong>
          </div>
          <div className="an-tip__label">
            {num_(months[hover].listings, locale)} {labels.approved} · {num_(months[hover].free_listings, locale)} {labels.free}
          </div>
        </div>
      )}
    </div>
  );
}

const num_ = (v, locale) => new Intl.NumberFormat(locale).format(Number(v) || 0);

function BarList({ rows, label, empty }) {
  if (!rows.length) return <p className="muted small" style={{ margin: 0 }}>{empty}</p>;
  const max = Math.max(...rows.map((r) => r.n));
  return (
    <div className="an-bars">
      {rows.map((r) => (
        <div key={r.key}>
          <span>{label(r.key)}</span>
          <span className="an-track"><span className="an-fill" style={{ width: `${(r.n / max) * 100}%` }} /></span>
          <span className="an-num">{r.n}</span>
        </div>
      ))}
    </div>
  );
}

/** The admin panel's Analytics tab: counts only, read from /api/admin/analytics. */
export function AdminAnalytics({ token, onAuthError }) {
  const { t, lang } = useI18n();
  const [report, setReport] = useState(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [metric, setMetric] = useState('listings');
  const locale = lang === 'vi' ? 'vi-VN' : 'en-US';
  const num = (v) => new Intl.NumberFormat(locale).format(Number(v) || 0);
  const a = (key) => t(`admin.analytics.${key}`);

  const load = useCallback(() => {
    setBusy(true);
    api.admin
      .analytics(token)
      .then((data) => { setReport(data); setFailed(false); })
      .catch((error) => { if (error.status === 401) onAuthError(); else setFailed(true); })
      .finally(() => setBusy(false));
  }, [token, onAuthError]);

  useEffect(() => {
    load();
    const id = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 60000);
    return () => clearInterval(id);
  }, [load]);

  if (!report) {
    return failed
      ? <div className="notice notice--warning">{a('loadError')}</div>
      : <p className="muted">{t('common.loading')}</p>;
  }

  const status = report.listings?.by_status || {};
  const monthly = report.monthly || [];
  const current = monthly.find((m) => m.month === thisMonth());
  const statusTotal = Object.values(status).reduce((s, v) => s + v, 0);
  const waiting = status.awaiting_approval || 0;
  const updated = new Date(report.generated_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });

  return (
    <>
      <div className="an-bar">
        <p className="muted small" style={{ margin: 0, maxWidth: '62ch' }}>{a('lead')}</p>
        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
          <span className="small muted">{a('updated')} {updated}</span>
          <button type="button" className="btn btn--ghost btn--small" onClick={load} disabled={busy}>
            {busy ? t('common.loading') : a('refresh')}
          </button>
        </div>
      </div>
      {failed && <div className="notice notice--warning" style={{ marginBottom: 16 }}>{a('loadError')}</div>}

      <div className="an-stats">
        <Stat label={a('liveNow')} value={num(report.live_visitors)} />
        <Stat label={a('earnedMonth')} value={formatPrice(current ? current.fees_vnd : 0, lang)} sub={`${num(current ? current.listings : 0)} ${a('approved')}`} />
        <Stat label={a('totalEarned')} value={formatPrice(report.fees_vnd?.collected, lang)} sub={report.fees_vnd?.awaiting_approval ? `${formatPrice(report.fees_vnd.awaiting_approval, lang)} ${a('pending')}` : undefined} />
        <Stat label={a('liveListings')} value={num(status.published)} sub={`+${num(report.listings?.published_7d)} ${a('thisWeek')}`} />
        <Stat label={a('waiting')} value={num(waiting)} sub={waiting ? a('needsYou') : a('queueClear')} />
        <Stat label={a('accounts')} value={num(report.users?.total)} sub={`+${num(report.users?.new_7d)} ${a('thisWeek')}`} />
        <Stat label={a('views')} value={num(report.listings?.total_views)} />
        <Stat label={a('buyRequests')} value={num(report.engagement?.buy_requests)} sub={`+${num(report.engagement?.buy_requests_7d)} ${a('thisWeek')}`} />
      </div>

      <div className="an-grid">
        <section>
          <div className="spread" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
            <h2 style={{ fontSize: '1.05rem', margin: 0 }}>{a('last30')}</h2>
            <div className="tabs" role="tablist">
              {METRICS.map((m) => (
                <button key={m} type="button" role="tab" className="tab" aria-selected={metric === m} onClick={() => setMetric(m)}>
                  {a(METRIC_LABEL[m])}
                </button>
              ))}
            </div>
          </div>
          <div className="card panel">
            <DailyChart days={report.daily || []} metric={metric} label={a(METRIC_LABEL[metric]).toLowerCase()} />
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: '1.05rem', margin: '0 0 12px' }}>{a('pipeline')}</h2>
          <div className="card panel">
            <div className="an-pipe" role="img" aria-label={`${statusTotal} ${a('listingsTotal')}`}>
              {STATUSES.filter(([k]) => status[k]).map(([k, color]) => (
                <span key={k} style={{ width: `${(status[k] / statusTotal) * 100}%`, background: color }} title={`${a(`status_${k}`)}: ${status[k]}`} />
              ))}
            </div>
            <div className="an-legend">
              {STATUSES.map(([k, color]) => (
                <div key={k}>
                  <i style={{ background: color }} />
                  <span>{a(`status_${k}`)}</span>
                  <span className="an-num">{num(status[k])}</span>
                </div>
              ))}
            </div>
            <p className="small muted" style={{ margin: '14px 0 0' }}>
              {a('listingsTotal')}: {num(statusTotal)} · {a('newThisWeek')}: {num(report.listings?.new_7d)}
            </p>
          </div>
        </section>
      </div>

      <section className="an-section">
        <h2>{a('monthly')}</h2>
        {monthly.length > 0 && (
          <div className="card panel" style={{ marginBottom: 12 }}>
            <MonthlyChart
              months={monthSeries(monthly)}
              lang={lang}
              locale={locale}
              labels={{ title: a('monthly'), approved: a('approved'), free: a('freeShort') }}
            />
            {monthSeries(monthly).length === 1 && <p className="small muted" style={{ margin: '8px 0 0' }}>{a('oneMonth')}</p>}
          </div>
        )}
        <div className="card panel table-scroll">
          {monthly.length === 0 ? (
            <p className="muted small" style={{ margin: 0 }}>{a('noApproved')}</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{a('month')}</th>
                  <th className="an-num">{a('fees')}</th>
                  <th className="an-num">{a('approvedCol')}</th>
                  <th className="an-num">{a('freeCol')}</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map((m) => (
                  <tr key={m.month}>
                    <td className="an-nowrap">{m.month}</td>
                    <td className="an-num">{formatPrice(m.fees_vnd, lang)}</td>
                    <td className="an-num">{num(m.listings)}</td>
                    <td className="an-num">{num(m.free_listings)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="an-section">
        <h2>{a('engagement')}</h2>
        <div className="an-stats" style={{ marginBottom: 0 }}>
          <Stat label={a('buyRequests')} value={num(report.engagement?.buy_requests)} sub={`+${num(report.engagement?.buy_requests_7d)} ${a('thisWeek')}`} />
          <Stat label={a('conversations')} value={num(report.engagement?.conversations)} />
          <Stat label={a('chatMessages')} value={num(report.engagement?.chat_messages)} sub={`+${num(report.engagement?.chat_messages_7d)} ${a('thisWeek')}`} />
          <Stat label={a('contactForm')} value={num(report.engagement?.contact_messages)} />
        </div>
      </section>

      <section className="an-section">
        <h2>{a('top')}</h2>
        <div className="card panel table-scroll">
          {(report.top_listings || []).length === 0 ? (
            <p className="muted small" style={{ margin: 0 }}>{a('noLive')}</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{a('listing')}</th>
                  <th>{a('district')}</th>
                  <th className="an-num">{a('price')}</th>
                  <th className="an-num">{a('views')}</th>
                  <th className="an-num">{a('buyRequests')}</th>
                  <th className="an-num">{a('chats')}</th>
                  <th>{a('since')}</th>
                </tr>
              </thead>
              <tbody>
                {report.top_listings.map((l) => (
                  <tr key={l.ref}>
                    <td>
                      <div>{l.title}</div>
                      <div className="small muted" style={{ fontFamily: 'ui-monospace, monospace' }}>{l.ref} · {t(`categories.${l.category}`)}</div>
                    </td>
                    <td>{t(`districts.${l.district}`)}</td>
                    <td className="an-num">{formatPrice(l.price_vnd, lang)}</td>
                    <td className="an-num">{num(l.views)}</td>
                    <td className="an-num">{num(l.buy_requests)}</td>
                    <td className="an-num">{num(l.conversations)}</td>
                    <td>{l.published_at ? formatDate(l.published_at, lang) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <div className="an-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <section>
          <h2 style={{ fontSize: '1.05rem', margin: '0 0 12px' }}>{a('byDistrict')}</h2>
          <div className="card panel">
            <BarList rows={report.by_district || []} label={(k) => t(`districts.${k}`)} empty={a('noLive')} />
          </div>
        </section>
        <section>
          <h2 style={{ fontSize: '1.05rem', margin: '0 0 12px' }}>{a('byCategory')}</h2>
          <div className="card panel">
            <BarList rows={report.by_category || []} label={(k) => t(`categories.${k}`)} empty={a('noLive')} />
          </div>
        </section>
      </div>
    </>
  );
}
