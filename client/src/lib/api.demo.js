/*
 * DEMO BACKEND — used only by `npm run demo`, never in a real install.
 *
 * It implements exactly the same surface as lib/api.js, but entirely in the
 * browser: listings live in memory (seeded from the real sample data) and
 * survive a refresh via localStorage. There is no server, no database, and no
 * money involved. The VietQR payload is built with the same module the real
 * server uses, so the QR code on the payment page is genuinely valid.
 *
 * Everything resets when the visitor clears the page's storage.
 */
import { buildVietQrPayload, findBank, BANKS } from '../../../server/src/vietqr.js';
import SEED from './demo-listings.json';

const STORAGE_KEY = 'vong.demo.state';
const CATEGORIES = ['furniture', 'clothing', 'electronics', 'books', 'household', 'hobby'];
const DISTRICTS = ['district_1', 'district_3', 'district_7', 'binh_thanh', 'thao_dien'];
const CONDITIONS = ['like_new', 'good', 'fair', 'well_used'];

const DEFAULT_SETTINGS = {
  bank_bin: '970436',
  bank_name: 'Vietcombank',
  account_number: '1234567890',
  account_holder: 'NGUYEN VAN A',
  fee_vnd: 10000,
};

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved?.listings?.length) return saved;
  } catch {
    /* fall through to a fresh state */
  }
  return { listings: [...SEED], settings: { ...DEFAULT_SETTINGS }, messages: [] };
}

let state = load();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* Storage full or blocked: the demo still works until reload. */
  }
}

/** Mimics the real API's failure shape so the pages handle errors identically. */
class DemoError extends Error {
  constructor(status, payload) {
    super(payload?.error ?? 'error');
    this.status = status;
    this.payload = payload ?? {};
  }
}

// A touch of latency, so loading states are visible rather than flashing past.
const reply = (value) => new Promise((resolve) => setTimeout(() => resolve(value), 160));

function randomRef() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `VONG-${code}`;
}

const SORTS = {
  newest: (a, b) => new Date(b.published_at || b.created_at) - new Date(a.published_at || a.created_at),
  price_asc: (a, b) => a.price_vnd - b.price_vnd,
  price_desc: (a, b) => b.price_vnd - a.price_vnd,
};

/** Strips the seller's phone, exactly as the real endpoints do. */
const publicView = ({ seller_phone, ...rest }) => rest;

export const api = {
  meta: () =>
    reply({
      categories: CATEGORIES,
      districts: DISTRICTS,
      conditions: CONDITIONS,
      fee_vnd: state.settings.fee_vnd,
    }),

  listings: ({ search = '', category = '', sort = 'newest', ids } = {}) => {
    let listings = state.listings.filter((listing) => listing.status === 'published');

    if (ids?.length) listings = listings.filter((listing) => ids.includes(listing.id));
    if (category) listings = listings.filter((listing) => listing.category === category);

    if (search) {
      const q = search.trim().toLowerCase();
      listings = listings.filter((listing) =>
        [
          listing.title_en,
          listing.title_vi,
          listing.description_en,
          listing.description_vi,
          listing.district.replace(/_/g, ' '),
        ]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(q))
      );
    }

    return reply({ listings: [...listings].sort(SORTS[sort] ?? SORTS.newest).map(publicView) });
  },

  listing: (id, { countView = true } = {}) => {
    const listing = state.listings.find((item) => item.id === id);
    if (!listing) return Promise.reject(new DemoError(404, { error: 'not_found' }));
    if (countView && listing.status === 'published') {
      listing.views += 1;
      persist();
    }
    return reply({ listing: publicView(listing) });
  },

  createListing: (formData) => {
    const get = (key) => String(formData.get(key) ?? '').trim();
    const price = Number(get('price_vnd').replace(/[^\d]/g, ''));
    const fields = {};

    if (get('title').length < 4) fields.title = 'length';
    if (get('description').length < 20) fields.description = 'length';
    if (!CATEGORIES.includes(get('category'))) fields.category = 'invalid';
    if (!DISTRICTS.includes(get('district'))) fields.district = 'invalid';
    if (!CONDITIONS.includes(get('condition'))) fields.condition = 'invalid';
    if (!Number.isFinite(price) || price < 1000) fields.price_vnd = 'invalid';
    if (get('seller_name').length < 2) fields.seller_name = 'length';
    if (!/^[\d\s+().-]{8,20}$/.test(get('seller_phone'))) fields.seller_phone = 'invalid';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(get('seller_email'))) fields.seller_email = 'invalid';

    if (Object.keys(fields).length > 0) {
      return Promise.reject(new DemoError(400, { error: 'validation_failed', fields }));
    }

    const lang = get('lang') === 'vi' ? 'vi' : 'en';
    const image = formData.get('image');
    const id = `local-${Date.now()}`;
    const ref = randomRef();

    state.listings.unshift({
      id,
      ref,
      title_en: lang === 'en' ? get('title') : null,
      title_vi: lang === 'vi' ? get('title') : null,
      description_en: lang === 'en' ? get('description') : null,
      description_vi: lang === 'vi' ? get('description') : null,
      category: get('category'),
      price_vnd: price,
      district: get('district'),
      condition: get('condition'),
      seller_name: get('seller_name'),
      seller_phone: get('seller_phone'),
      seller_email: get('seller_email'),
      // Object URLs do not survive a reload; the card falls back to the empty state.
      image_path: image && image.size ? URL.createObjectURL(image) : null,
      status: 'pending_payment',
      reject_reason: null,
      fee_vnd: state.settings.fee_vnd,
      views: 0,
      created_at: new Date().toISOString(),
      published_at: null,
      paid_marked_at: null,
    });
    persist();

    return reply({ id, ref, status: 'pending_payment', fee_vnd: state.settings.fee_vnd });
  },

  payment: (id) => {
    const listing = state.listings.find((item) => item.id === id);
    if (!listing) return Promise.reject(new DemoError(404, { error: 'not_found' }));

    const payload = buildVietQrPayload({
      bankBin: state.settings.bank_bin,
      accountNumber: state.settings.account_number,
      amount: listing.fee_vnd,
      note: listing.ref,
    });
    const bank = findBank(state.settings.bank_bin);

    return reply({
      listing: {
        id: listing.id,
        ref: listing.ref,
        status: listing.status,
        title_en: listing.title_en,
        title_vi: listing.title_vi,
        reject_reason: listing.reject_reason,
      },
      payment: {
        qr_payload: payload,
        amount_vnd: listing.fee_vnd,
        reference: listing.ref,
        bank_bin: state.settings.bank_bin,
        bank_name: bank ? bank.name : state.settings.bank_name,
        account_number: state.settings.account_number,
        account_holder: state.settings.account_holder,
      },
    });
  },

  markPaid: (id) => {
    const listing = state.listings.find((item) => item.id === id);
    if (!listing) return Promise.reject(new DemoError(404, { error: 'not_found' }));
    listing.status = 'awaiting_approval';
    listing.paid_marked_at = new Date().toISOString();
    listing.reject_reason = null;
    persist();
    return reply({ id, status: 'awaiting_approval' });
  },

  buyRequest: (id) => {
    const listing = state.listings.find((item) => item.id === id && item.status === 'published');
    if (!listing) return Promise.reject(new DemoError(404, { error: 'not_found' }));
    return reply({ seller_name: listing.seller_name, seller_phone: listing.seller_phone });
  },

  contact: (body) => {
    state.messages.unshift({ id: Date.now(), ...body, body: body.message, created_at: new Date().toISOString() });
    persist();
    return reply({ ok: true });
  },

  admin: {
    login: (password) =>
      password === 'vong-admin'
        ? reply({ token: 'demo-token', expiresIn: 3600000, default_password: true })
        : Promise.reject(new DemoError(401, { error: 'bad_password' })),

    listings: (token, status) => {
      const counts = { pending_payment: 0, awaiting_approval: 0, published: 0, rejected: 0 };
      for (const listing of state.listings) counts[listing.status] += 1;
      return reply({ listings: state.listings.filter((listing) => listing.status === status), counts });
    },

    approve: (token, id) => {
      const listing = state.listings.find((item) => item.id === id);
      const now = new Date().toISOString();
      Object.assign(listing, { status: 'published', published_at: now, reviewed_at: now, reject_reason: null });
      persist();
      return reply({ id, status: 'published' });
    },

    reject: (token, id, reason) => {
      const listing = state.listings.find((item) => item.id === id);
      Object.assign(listing, { status: 'rejected', reject_reason: reason, reviewed_at: new Date().toISOString() });
      persist();
      return reply({ id, status: 'rejected', reject_reason: reason });
    },

    settings: () => reply({ settings: state.settings, banks: BANKS, default_password: true }),

    saveSettings: (token, patch) => {
      const bank = patch.bank_bin ? findBank(patch.bank_bin) : null;
      state.settings = {
        ...state.settings,
        ...patch,
        fee_vnd: Number(patch.fee_vnd) || state.settings.fee_vnd,
        bank_name: bank ? bank.name : state.settings.bank_name,
      };
      persist();
      return reply({ settings: state.settings });
    },

    messages: () => reply({ messages: state.messages }),
  },
};

export class ApiError extends DemoError {}
