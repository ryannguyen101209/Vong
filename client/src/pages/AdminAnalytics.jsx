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
  const a = (key, vars) => t(`admin.analytics.${key}`, vars);

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
  const replies = report.replies_30d || { chats: 0, answered: 0 };
  const cities = report.cities || [];
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
        <Stat label={a('sold')} value={num(report.sold?.total)} sub={`+${num(report.sold?.last_30d)} ${a('in30Days')}`} />
        <Stat
          label={a('replyRate')}
          value={replies.chats ? `${Math.round((replies.answered / replies.chats) * 100)}%` : '–'}
          sub={replies.chats ? a('replyRateSub', { answered: num(replies.answered), chats: num(replies.chats) }) : undefined}
        />
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
        <h2>{a('byCityTitle')}</h2>
        <div className="card panel table-scroll">
          {cities.length === 0 ? (
            <p className="muted small" style={{ margin: 0 }}>{a('noLive')}</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{a('city')}</th>
                  <th className="an-num">{a('liveListings')}</th>
                  <th className="an-num">{a('new30Days')}</th>
                  <th className="an-num">{a('sold')}</th>
                  <th className="an-num">{a('views')}</th>
                </tr>
              </thead>
              <tbody>
                {cities.map((c) => (
                  <tr key={c.city}>
                    <td className="an-nowrap">{t(`cities.${c.city}`)}</td>
                    <td className="an-num">{num(c.live)}</td>
                    <td className="an-num">{num(c.new_30d)}</td>
                    <td className="an-num">{num(c.sold)}</td>
                    <td className="an-num">{num(c.views)}</td>
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
