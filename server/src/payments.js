/**
 * Automatic payment matching.
 *
 * A bank-watching service (SePay) calls our webhook for every transfer into the
 * shop's account. The seller's transfer note carries the listing reference
 * (VONG-A1B2C3), so we can match money to a listing without a human.
 *
 * Safety rules:
 *  - a transfer is applied at most once (keyed by the provider's transaction id);
 *  - it must reach the listing's fee, underpayments are only flagged to the owner;
 *  - by default a verified payment moves the listing to the review queue and the
 *    owner still approves the content. PAYMENT_AUTO_PUBLISH=true publishes it directly.
 */
import { notifyOwner } from './notify.js';
import { emailUser } from './mailer.js';

// Refs never contain I, O, 0 or 1 (see ids.js). Match them after stripping
// everything but letters and digits, because banks mangle spaces and dashes.
const REF_RE = /VONG([A-HJ-NP-Z2-9]{6})/g;

const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'D').toUpperCase();

/** Every listing reference found in a transfer note, as "VONG-XXXXXX". */
export function findRefs(content) {
  const squashed = fold(content).replace(/[^A-Z0-9]/g, '');
  const out = [];
  for (const m of squashed.matchAll(new RegExp(REF_RE.source, 'g'))) {
    const ref = `VONG-${m[1]}`;
    if (!out.includes(ref)) out.push(ref);
  }
  return out;
}

const vnd = (n) => `${Number(n).toLocaleString('en-US')} VND`;

/**
 * Apply one incoming transfer. Returns { outcome, listingId? }.
 * outcome: duplicate | no_match | underpaid | already_paid | wrong_status | confirmed | published
 */
export function applyTransfer(db, { provider = 'sepay', txnId, amount, content, receivedAt }, { autoPublish = false, now = new Date() } = {}) {
  const id = String(txnId);
  const amountVnd = Math.trunc(Number(amount));
  if (!id || !Number.isFinite(amountVnd) || amountVnd <= 0) return { outcome: 'ignored' };

  const record = (outcome, listingId = null) => db.prepare(
    'INSERT INTO bank_transactions (provider, txn_id, listing_id, amount_vnd, content, received_at, outcome, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(provider, id, listingId, amountVnd, String(content ?? '').slice(0, 300), receivedAt ?? null, outcome, now.toISOString());

  const result = db.transaction(() => {
    if (db.prepare('SELECT 1 FROM bank_transactions WHERE provider = ? AND txn_id = ?').get(provider, id)) return { outcome: 'duplicate' };

    const refs = findRefs(content);
    const listing = refs.map((ref) => db.prepare(
      `SELECT l.id, l.ref, l.status, l.fee_vnd, l.payment_verified_at, l.title_en, l.title_vi, COALESCE(u.email, l.seller_email) AS email
       FROM listings l LEFT JOIN users u ON u.id = l.seller_id WHERE l.ref = ? AND l.is_seed = 0`,
    ).get(ref)).find(Boolean);

    if (!listing || listing.fee_vnd <= 0) { record('no_match'); return { outcome: 'no_match' }; }
    if (amountVnd < listing.fee_vnd) { record('underpaid', listing.id); return { outcome: 'underpaid', listing }; }
    if (listing.payment_verified_at || listing.status === 'published' || listing.status === 'sold') { record('already_paid', listing.id); return { outcome: 'already_paid', listing }; }
    if (listing.status !== 'pending_payment' && listing.status !== 'awaiting_approval') { record('wrong_status', listing.id); return { outcome: 'wrong_status', listing }; }

    const iso = now.toISOString();
    if (autoPublish) {
      db.prepare("UPDATE listings SET status = 'published', payment_verified_at = ?, paid_marked_at = COALESCE(paid_marked_at, ?), reviewed_at = ?, published_at = ?, reject_reason = NULL WHERE id = ?")
        .run(iso, iso, iso, iso, listing.id);
    } else {
      db.prepare("UPDATE listings SET status = 'awaiting_approval', payment_verified_at = ?, paid_marked_at = COALESCE(paid_marked_at, ?), reject_reason = NULL WHERE id = ?")
        .run(iso, iso, listing.id);
    }
    const outcome = autoPublish ? 'published' : 'confirmed';
    record(outcome, listing.id);
    return { outcome, listing };
  })();

  // Side effects after the database is settled. Never allowed to throw.
  try {
    const l = result.listing;
    if (result.outcome === 'confirmed') {
      notifyOwner({ title: 'Payment received', message: `${l.ref} · ${vnd(amountVnd)} matched. Review and approve.`, tags: ['white_check_mark'] });
      emailUser(l.email, 'payment_received', { listingId: l.id, titleEn: l.title_en, titleVi: l.title_vi });
    } else if (result.outcome === 'published') {
      notifyOwner({ title: 'Payment received, listing published', message: `${l.ref} · ${vnd(amountVnd)}`, tags: ['tada'] });
      emailUser(l.email, 'listing_approved', { listingId: l.id, titleEn: l.title_en, titleVi: l.title_vi });
    } else if (result.outcome === 'underpaid') {
      notifyOwner({ title: 'Payment too small', message: `${l.ref}: got ${vnd(amountVnd)}, fee is ${vnd(l.fee_vnd)}. Not confirmed.`, tags: ['warning'] });
    } else if (result.outcome === 'already_paid') {
      notifyOwner({ title: 'Duplicate payment', message: `${l.ref} is already live and another ${vnd(amountVnd)} arrived. Refund it?`, tags: ['warning'] });
    } else if (result.outcome === 'no_match') {
      notifyOwner({ title: 'Transfer with no match', message: `${vnd(amountVnd)} arrived with note "${String(content ?? '').slice(0, 80)}". No listing reference found.`, tags: ['question'] });
    }
  } catch { /* alerts are best effort */ }

  return result;
}
