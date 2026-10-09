/**
 * Transactional email for sellers and buyers, sent through Resend
 * (https://resend.com) over plain HTTPS, so there is no new dependency.
 *
 * Off unless RESEND_API_KEY is set, like the ntfy alerts in notify.js.
 * Fire-and-forget: a mail failure must never break a request.
 *
 * Emails are bilingual (Vietnamese first, English below) because accounts do
 * not store a language. They never contain a phone number or another user's
 * email address.
 */
const TIMEOUT_MS = 8000;
export const MESSAGE_EMAIL_COOLDOWN_MS = 10 * 60 * 1000;

const GREEN = '#38604A';
const INK = '#25332B';
const PAGE = '#FAFBF8';
const SOFT = '#EAF0E5';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clip = (s, n) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const site = () => (process.env.PUBLIC_URL || 'https://usevong.com').replace(/\/+$/, '');

function layout({ heading, bodyVi, bodyEn, button, url, reason }) {
  const btn = button
    ? `<p style="margin:24px 0 0"><a href="${esc(url)}" style="display:inline-block;background:${GREEN};color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px">${esc(button.vi)} / ${esc(button.en)}</a></p>`
    : '';
  const quote = reason
    ? `<blockquote style="margin:14px 0 0;padding:12px 14px;background:${SOFT};border-radius:8px;color:${INK}">${esc(reason)}</blockquote>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:${PAGE};font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK}">
<div style="max-width:520px;margin:0 auto;padding:28px 20px">
<p style="margin:0 0 18px;font-size:22px;font-weight:700;color:${GREEN}">Vòng</p>
<h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">${esc(heading.vi)}</h1>
<p style="margin:0;line-height:1.55">${bodyVi}</p>${quote}${btn}
<hr style="border:0;border-top:1px solid #dfe5da;margin:28px 0 20px">
<h2 style="margin:0 0 10px;font-size:16px;line-height:1.3">${esc(heading.en)}</h2>
<p style="margin:0;line-height:1.55;color:#4b5a51">${bodyEn}</p>
<p style="margin:28px 0 0;font-size:12px;color:#7b8a80">usevong.com · Mua bán đồ cũ ở Sài Gòn / Secondhand in Saigon</p>
</div></body></html>`;
}

/** Build {subject, text, html} for one event. Pure, so it is easy to test. */
export function buildEmail(kind, data) {
  const base = site();
  if (kind === 'listing_approved') {
    const titleVi = clip(data.titleVi || data.titleEn, 80);
    const titleEn = clip(data.titleEn || data.titleVi, 80);
    const url = `${base}/listing/${encodeURIComponent(data.listingId)}`;
    return {
      subject: `Tin "${titleVi}" đã lên sàn · Your listing is live`,
      text: `Tin "${titleVi}" của bạn đã được duyệt và đang hiển thị trên Vòng. Người mua giờ có thể nhắn cho bạn.\n${url}\n\n---\nYour listing "${titleEn}" is approved and live on Vòng. Buyers can message you now.\n${url}`,
      html: layout({
        heading: { vi: 'Tin của bạn đã lên sàn', en: 'Your listing is live' },
        bodyVi: `Tin <b>${esc(titleVi)}</b> đã được duyệt và đang hiển thị trên Vòng. Có người quan tâm là họ sẽ nhắn cho bạn ngay trên web.`,
        bodyEn: `<b>${esc(titleEn)}</b> is approved and visible on Vòng. Buyers will message you right on the site.`,
        button: { vi: 'Xem tin', en: 'View listing' }, url,
      }),
    };
  }
  if (kind === 'listing_rejected') {
    const titleVi = clip(data.titleVi || data.titleEn, 80);
    const titleEn = clip(data.titleEn || data.titleVi, 80);
    const reason = clip(data.reason, 500);
    const url = `${base}/my-listings`;
    return {
      subject: `Tin "${titleVi}" chưa được duyệt · Your listing needs changes`,
      text: `Tin "${titleVi}" chưa được duyệt.\nLý do: ${reason}\nBạn có thể sửa tin rồi gửi lại: ${url}\n\n---\nYour listing "${titleEn}" was not approved.\nReason: ${reason}\nYou can edit it and submit again: ${url}`,
      html: layout({
        heading: { vi: 'Tin của bạn chưa được duyệt', en: 'Your listing needs changes' },
        bodyVi: `Tin <b>${esc(titleVi)}</b> chưa được duyệt. Lý do:`,
        bodyEn: `<b>${esc(titleEn)}</b> was not approved. The reason is quoted above. You can edit the listing and submit it again.`,
        reason, button: { vi: 'Sửa tin', en: 'Edit listing' }, url,
      }),
    };
  }
  if (kind === 'payment_received') {
    const titleVi = clip(data.titleVi || data.titleEn, 80);
    const titleEn = clip(data.titleEn || data.titleVi, 80);
    const url = `${base}/payment/${encodeURIComponent(data.listingId)}`;
    return {
      subject: `Đã nhận tiền cho tin "${titleVi}" · Payment received`,
      text: `Vòng đã nhận được khoản chuyển cho tin "${titleVi}". Tin đang chờ duyệt và sẽ lên sàn sớm.\n${url}\n\n---\nWe received your payment for "${titleEn}". It is now in review and will go live soon.\n${url}`,
      html: layout({
        heading: { vi: 'Đã nhận tiền, tin đang chờ duyệt', en: 'Payment received, your listing is in review' },
        bodyVi: `Vòng đã nhận được khoản chuyển cho tin <b>${esc(titleVi)}</b>. Bạn không cần làm gì thêm, tin sẽ lên sàn ngay khi được duyệt.`,
        bodyEn: `We received your payment for <b>${esc(titleEn)}</b>. Nothing more to do: it goes live as soon as it is reviewed.`,
        button: { vi: 'Xem trạng thái', en: 'View status' }, url,
      }),
    };
  }
  if (kind === 'new_message') {
    const from = clip(data.fromName, 40) || 'Someone';
    const titleVi = clip(data.titleVi || data.titleEn, 80);
    const titleEn = clip(data.titleEn || data.titleVi, 80);
    const preview = clip(data.body, 140);
    const url = `${base}/messages`;
    return {
      subject: `${from} nhắn về "${titleVi}" · New message on Vòng`,
      text: `${from} vừa nhắn cho bạn về "${titleVi}":\n"${preview}"\nTrả lời tại: ${url}\n\n---\n${from} sent you a message about "${titleEn}":\n"${preview}"\nReply here: ${url}`,
      html: layout({
        heading: { vi: `${from} vừa nhắn cho bạn`, en: `New message from ${from}` },
        bodyVi: `Về tin <b>${esc(titleVi)}</b>. Trả lời sớm thì dễ chốt hơn.`,
        bodyEn: `About <b>${esc(titleEn)}</b>. A quick reply makes a sale more likely.`,
        reason: preview, button: { vi: 'Mở tin nhắn', en: 'Open messages' }, url,
      }),
    };
  }
  if (kind === 'welcome') {
    const name = clip(data.name, 40);
    const hi = { vi: name ? `Chào ${name},` : 'Chào bạn,', en: name ? `Hi ${name},` : 'Hi,' };
    const url = `${base}/sell`;
    return {
      subject: 'Chào mừng bạn đến với Vòng · Welcome to Vòng',
      text: `${hi.vi}\n\nCảm ơn bạn đã tham gia Vòng, chợ đồ cũ cho người Sài Gòn.\n- Dạo xem đồ cũ quanh bạn và lưu món ưng ý.\n- Nhắn người bán ngay trên web, không cần đưa số điện thoại.\n- Món đầu tiên bạn đăng bán là miễn phí.\n\nĐăng món đầu tiên: ${url}\n\n---\n${hi.en}\n\nThanks for joining Vòng, the secondhand market for Saigon.\n- Browse used things near you and save the ones you like.\n- Message sellers right on the site, no phone number needed.\n- Your first listing is free.\n\nPost your first listing: ${url}`,
      html: layout({
        heading: { vi: 'Chào mừng bạn đến với Vòng', en: 'Welcome to Vòng' },
        bodyVi: `${esc(hi.vi)}<br><br>Cảm ơn bạn đã tham gia Vòng, chợ đồ cũ cho người Sài Gòn.<br>• Dạo xem đồ cũ quanh bạn và lưu món ưng ý.<br>• Nhắn người bán ngay trên web, không cần đưa số điện thoại.<br>• <b>Món đầu tiên bạn đăng bán là miễn phí.</b>`,
        bodyEn: `${esc(hi.en)}<br><br>Thanks for joining Vòng, the secondhand market for Saigon. Browse used things near you, message sellers right on the site, and post your first listing for free.`,
        button: { vi: 'Đăng món đầu tiên', en: 'Post your first listing' }, url,
      }),
    };
  }
  throw new Error(`unknown email kind: ${kind}`);
}

/** True when email is configured. Callers check this before doing throttle bookkeeping. */
export const mailEnabled = () => Boolean(process.env.RESEND_API_KEY?.trim());

/**
 * Send one email. No-op without RESEND_API_KEY or a recipient. Never throws.
 * Resolves to true when the provider accepted it; most callers ignore that.
 */
export function sendMail({ to, subject, html, text, attachments, timeoutMs = TIMEOUT_MS }) {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key || !to) return Promise.resolve(false);
  const api = (process.env.RESEND_API_URL || 'https://api.resend.com').replace(/\/+$/, '');
  const from = process.env.MAIL_FROM?.trim() || 'Vòng <onboarding@resend.dev>';
  const payload = { from, to: [to], subject, html, text };
  if (process.env.MAIL_REPLY_TO?.trim()) payload.reply_to = process.env.MAIL_REPLY_TO.trim();
  if (attachments?.length) payload.attachments = attachments;

  return fetch(`${api}/emails`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  }).then((response) => response.ok, () => false);
}

/** Build and send in one call. */
export function emailUser(to, kind, data) {
  if (!to) return;
  try { sendMail({ to, ...buildEmail(kind, data) }); } catch { /* never break a request */ }
}

/**
 * Chat emails are rate-limited per conversation and recipient so a fast
 * back-and-forth does not flood an inbox: one email, then silence for the
 * cooldown. Returns true when an email should go out now (and records it).
 */
export function claimMessageEmail(db, conversationId, userId, now = Date.now(), cooldownMs = MESSAGE_EMAIL_COOLDOWN_MS) {
  db.exec(`CREATE TABLE IF NOT EXISTS email_throttle (
    conversation_id TEXT NOT NULL, user_id TEXT NOT NULL, sent_at INTEGER NOT NULL,
    PRIMARY KEY (conversation_id, user_id))`);
  const row = db.prepare('SELECT sent_at FROM email_throttle WHERE conversation_id = ? AND user_id = ?').get(conversationId, userId);
  if (row && now - row.sent_at < cooldownMs) return false;
  db.prepare(`INSERT INTO email_throttle (conversation_id, user_id, sent_at) VALUES (?, ?, ?)
    ON CONFLICT(conversation_id, user_id) DO UPDATE SET sent_at = excluded.sent_at`).run(conversationId, userId, now);
  return true;
}
