import crypto from 'node:crypto';
import express from 'express';
import { db } from '../db.js';
import { applyTransfer } from '../payments.js';

/**
 * POST /api/payments/sepay — SePay calls this for every transaction on the
 * linked bank account. Authenticated with "Authorization: Apikey <SEPAY_API_KEY>".
 * Off (404) unless SEPAY_API_KEY is set. Answers {"success": true} so SePay does
 * not retry, including for transfers we could not match; those are alerted to
 * the owner instead.
 */
export const router = express.Router();

function keyMatches(header) {
  const expected = process.env.SEPAY_API_KEY || '';
  const given = /^Apikey\s+(.+)$/i.exec(String(header ?? ''))?.[1]?.trim();
  if (expected.length < 16 || !given) return false;
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

router.post('/sepay', (req, res) => {
  if (!process.env.SEPAY_API_KEY) return res.status(404).json({ error: 'not_found' });
  if (!keyMatches(req.get('authorization'))) return res.status(401).json({ error: 'unauthorized' });

  const body = req.body ?? {};
  // Only money coming in, and only for our account if one is pinned.
  if (body.transferType !== 'in') return res.json({ success: true });
  const pinned = process.env.SEPAY_ACCOUNT_NUMBER?.trim();
  if (pinned && String(body.accountNumber ?? '').trim() !== pinned) return res.json({ success: true });

  const autoPublish = ['1', 'true', 'yes'].includes(String(process.env.PAYMENT_AUTO_PUBLISH ?? '').toLowerCase());
  try {
    applyTransfer(db, { txnId: body.id, amount: body.transferAmount, content: body.content ?? body.description, receivedAt: body.transactionDate }, { autoPublish });
  } catch (err) {
    console.error('[sepay] could not apply transfer', body.id, err);
    return res.status(500).json({ success: false }); // let SePay retry
  }
  res.json({ success: true });
});
