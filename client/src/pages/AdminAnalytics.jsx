import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import { formatPrice, formatDate } from '../lib/format.js';

const METRICS = ['visitors', 'listings', 'users', 'buy_requests', 'conversations'];
const METRIC_LABEL = {
  visitors: 'metricVisitors',
  listings: 'metricListings',
  users: 'metricUsers',
  buy_requests: 'metricBuyRequests',
  conversations: 'metricConversations',
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

function niceScale(value) {
  const raw = Math.max(value, 4) / 4;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((st) => st >= raw && Number.isInteger(st)) ?? Math.ceil(raw);
  return { step, max: step * 4 };
}

const ACCOUNT_RANGES = [30, 90, 0]; // days; 0 = since the first account
const saigonToday = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/**
 * Line chart of the total number of accounts, day by day. One series, so no
 * legend: the section title names it. Hover or arrow keys show a day's total
 * and how many joined that day; a table view is under the chart.
 */
function AccountsChart({ byDay, locale }) {
  const { t } = useI18n();
  const a = (key, vars) => t(`admin.analytics.${key}`, vars);
  const [range, setRange] = useState(30);
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

  const today = saigonToday();
  const first = byDay[0]?.day ?? today;
  let start = range ? addDays(today, -(range - 1)) : first;
  if (start >= today) start = addDays(today, -1); // always at least two days, so there is a line
  const newOn = new Map(byDay.map((d) => [d.day, d.n]));
  let total = byDay.filter((d) => d.day < start).reduce((sum, d) => sum + d.n, 0);
  const days = [];
  for (let day = start; day <= today; day = addDays(day, 1)) {
    const joined = newOn.get(day) ?? 0;
    total += joined;
    days.push({ day, joined, total });
  }
  const n = days.length;
  const last = n - 1;
  const gained = days.reduce((sum, d) => sum + d.joined, 0);

  const { max, step } = niceScale(Math.max(...days.map((d) => d.total)));
  const H = 240, L = 40, R = 18, T = 28, B = 28;
  const iw = W - L - R, ih = H - T - B;
  const x = (i) => L + (i / (n - 1)) * iw;
  const y = (v) => T + ih - (v / max) * ih;
  const short = (day) => new Date(`${day}T00:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const long = (day) => new Date(`${day}T00:00:00Z`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  // About five date labels, always including today, never crowding each other.
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 90))));
  const points = days.map((d, i) => `${x(i).toFixed(1)},${y(d.total).toFixed(1)}`).join(' ');
  const summary = a('accountsSummary', { total: days[last].total, gained, from: long(start) });

  const nearest = (clientX, svg) => {
    const box = svg.getBoundingClientRect();
    const px = ((clientX - box.left) / box.width) * W;
    return Math.max(0, Math.min(last, Math.round(((px - L) / iw) * (n - 1))));
  };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); setHover((h) => Math.min(last, (h ?? -1) + 1)); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); setHover((h) => Math.max(0, (h ?? n) - 1)); }
    if (e.key === 'Escape') setHover(null);
  };
  const tipPct = hover === null ? 0 : (x(hover) / W) * 100;
  const shown = hover ?? last;

  return (
    <>
      <div className="spread" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
        <p style={{ margin: 0 }}>
          <strong style={{ fontSize: '1.4rem' }}>{days[last].total}</strong>{' '}
          <span className="small muted">{a('accountsNow', { gained })}</span>
        </p>
        <div className="tabs" role="tablist" aria-label={a('accountsTitle')}>
          {ACCOUNT_RANGES.map((r) => (
            <button key={r} type="button" role="tab" className="tab" aria-selected={range === r} onClick={() => { setRange(r); setHover(null); }}>
              {r ? a('lastDays', { n: r }) : a('allTime')}
            </button>
          ))}
        </div>
      </div>
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
              <text x={L - 8} y={y(step * i) + 4} textAnchor="end">{step * i}</text>
            </g>
          ))}
          {days.map((d, i) => ((last - i) % labelEvery === 0) && (
            <text key={d.day} x={x(i)} y={H - 8} textAnchor={i === last ? 'end' : i === 0 ? 'start' : 'middle'}>{short(d.day)}</text>
          ))}
          {hover !== null && <line className="cross" x1={x(hover)} x2={x(hover)} y1={T} y2={T + ih} />}
          <polyline className="line" points={points} />
          <circle className="dot" cx={x(shown)} cy={y(days[shown].total)} r="4.5" />
          {hover === null && (
            <text className="an-chart__value" x={x(last)} y={y(days[last].total) - 12} textAnchor="end">{days[last].total}</text>
          )}
        </svg>
        {hover !== null && (
          <div className={`an-tip${tipPct > 55 ? ' an-tip--left' : ''}`} style={{ left: `${tipPct}%` }} role="status">
            <div className="an-tip__label">{long(days[hover].day)}</div>
            <div className="an-tip__row">
              <i className="an-tip__key" />
              <strong className="an-tip__value">{days[hover].total}</strong>
              <span className="an-tip__label">{a('accountsUnit')}</span>
            </div>
            <div className="an-tip__label">{a('joinedThatDay', { n: days[hover].joined })}</div>
          </div>
        )}
      </div>
      <details className="an-table-view">
        <summary className="small">{a('showTable')}</summary>
        <div className="table-scroll">
          <table className="admin-table">
            <thead>
              <tr><th>{a('day')}</th><th className="an-num">{a('joined')}</th><th className="an-num">{a('accountsUnit')}</th></tr>
            </thead>
            <tbody>
              {days.filter((d) => d.joined > 0).reverse().map((d) => (
                <tr key={d.day}><td className="an-nowrap">{long(d.day)}</td><td className="an-num">+{d.joined}</td><td className="an-num">{d.total}</td></tr>
              ))}
            </tbody>
          </table>
          {gained === 0 && <p className="small muted" style={{ margin: '8px 0 0' }}>{a('noneJoined')}</p>}
        </div>
      </details>
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
/** The team's own and test accounts, left out of every number above. */
function ExcludedAccounts({ token, onAuthError, onSaved, counted }) {
  const { t } = useI18n();
  const a = (key, vars) => t(`admin.analytics.${key}`, vars);
  const [emails, setEmails] = useState(null);
  const [state, setState] = useState('idle');

  useEffect(() => {
    api.admin.settings(token)
      .then((data) => setEmails(data.settings.stats_exclude_emails || ''))
      .catch((error) => error.status === 401 && onAuthError());
  }, [token, onAuthError]);

  if (emails === null) return null;
  const save = async (event) => {
    event.preventDefault();
    setState('saving');
    try {
      const data = await api.admin.saveSettings(token, { stats_exclude_emails: emails });
      setEmails(data.settings.stats_exclude_emails || '');
      setState('saved');
      onSaved();
    } catch (error) {
      if (error.status === 401) onAuthError();
      setState('error');
    }
  };

  return (
    <section className="an-section">
      <h2>{a('excludeTitle')}</h2>
      <form className="card panel form" onSubmit={save} style={{ maxWidth: 620 }}>
        <p className="small muted" style={{ margin: 0 }}>{a('excludeHint')}</p>
        <textarea
          className="textarea"
          style={{ minHeight: 80 }}
          value={emails}
          onChange={(event) => { setEmails(event.target.value); setState('idle'); }}
          placeholder="ban@gmail.com, test@gmail.com"
          aria-label={a('excludeTitle')}
        />
        <div className="row" style={{ gap: 12, alignItems: 'center' }}>
          <button type="submit" className="btn btn--small" disabled={state === 'saving'}>{t('common.save')}</button>
          {state === 'saved' && <span className="small muted" role="status">{a('excludeSaved', { n: counted ?? 0 })}</span>}
          {state === 'error' && <span className="small" role="alert">{a('excludeError')}</span>}
        </div>
      </form>
    </section>
  );
}

export function AdminAnalytics({ token, onAuthError }) {
  const { t, lang } = useI18n();
  const [report, setReport] = useState(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [metric, setMetric] = useState('visitors');
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
        <Stat label={a('visitorsToday')} value={num(report.visitors?.today)} sub={a('visitorsYesterday', { n: num(report.visitors?.yesterday) })} />
        <Stat label={a('sold')} value={num(report.sold?.total)} sub={`+${num(report.sold?.last_30d)} ${a('in30Days')}`} />
        <Stat label={a('sellers')} value={num(report.sellers?.active)} sub={`+${num(report.sellers?.new_7d)} ${a('newSellers')}`} />
        <Stat label={a('liveListings')} value={num(status.published)} sub={`+${num(report.listings?.published_7d)} ${a('thisWeek')}`} />
        <Stat label={a('waiting')} value={num(waiting)} sub={waiting ? a('needsYou') : a('queueClear')} />
        <Stat label={a('accounts')} value={num(report.users?.total)} sub={`+${num(report.users?.new_7d)} ${a('thisWeek')}`} />
        <Stat label={a('buyRequests')} value={num(report.engagement?.buy_requests)} sub={`+${num(report.engagement?.buy_requests_7d)} ${a('thisWeek')}`} />
      </div>

      <div className="an-grid">
        <section>
          <div className="spread" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
            <h2 style={{ fontSize: '1.05rem', margin: 0 }}>{a('last30')}</h2>
            <div className="tabs" role="tablist" style={{ flexWrap: 'wrap' }}>
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
        <h2>{a('accountsTitle')}</h2>
        <div className="card panel">
          <AccountsChart byDay={report.users?.by_day || []} locale={locale} />
        </div>
      </section>

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
          <Stat label={a('conversations')} value={num(report.engagement?.conversations)} sub={`+${num(report.engagement?.conversations_7d)} ${a('thisWeek')}`} />
          <Stat label={a('buyers')} value={num(report.engagement?.buyers)} sub={`+${num(report.engagement?.buyers_7d)} ${a('thisWeek')}`} />
          <Stat label={a('contactForm')} value={num(report.engagement?.contact_messages)} />
        </div>
      </section>

      <ExcludedAccounts token={token} onAuthError={onAuthError} onSaved={load} counted={report.excluded_accounts} />

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
