/*
 * Thin fetch wrapper. In dev, Vite proxies /api to the Express server on :4000
 * (see vite.config.js), so nothing here needs to know about ports.
 */

export class ApiError extends Error {
  constructor(status, payload) {
    super(payload?.error || `Request failed (${status})`);
    this.status = status;
    this.payload = payload ?? {};
  }
}

async function request(path, options = {}) {
  const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
  const response = await fetch(`${base}${path}`, { ...options, credentials: 'include', headers: { 'X-Vong-Request': '1', ...options.headers } });
  const isJson = (response.headers.get('content-type') || '').includes('application/json');
  const payload = isJson ? await response.json() : null;

  if (!response.ok || !payload) throw new ApiError(response.status, payload);
  return payload;
}

export const api = {
  meta: () => request('/api/meta'),

  listings: ({ search = '', category = '', city = '', district = '', minPrice, maxPrice, sort = 'newest', ids } = {}) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (category) params.set('category', category);
    if (city) params.set('city', city);
    if (district) params.set('district', district);
    if (minPrice != null) params.set('min_price', String(minPrice));
    if (maxPrice != null) params.set('max_price', String(maxPrice));
    if (sort) params.set('sort', sort);
    if (ids?.length) params.set('ids', ids.join(','));
    return request(`/api/listings?${params.toString()}`);
  },

  listing: (id, { countView = true } = {}) =>
    request(`/api/listings/${id}${countView ? '' : '?count=0'}`),

  createListing: (formData) => request('/api/listings', { method: 'POST', body: formData }),

  payment: (id) => request(`/api/listings/${id}/payment`),

  /** Redeems a promo code on a listing that still owes the fee. */
  applyPromo: (id, code) =>
    request(`/api/listings/${id}/promo`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code }),
    }),

  markPaid: (id) => request(`/api/listings/${id}/mark-paid`, { method: 'POST' }),

  // Seller tools: the signed-in seller's own listings.
  /** Anonymous heartbeat for the owner's live visitor count. */
  ping: (id) => request('/api/presence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }),

  myListings: () => request('/api/listings/mine'),

  updateListing: (id, body) =>
    request(`/api/listings/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),

  markSold: (id) => request(`/api/listings/${id}/sold`, { method: 'POST' }),

  relist: (id) => request(`/api/listings/${id}/relist`, { method: 'POST' }),

  deleteListing: (id) => request(`/api/listings/${id}`, { method: 'DELETE' }),

  reportListing: (id, body) =>
    request(`/api/listings/${id}/report`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),

  buyRequest: (id) => request(`/api/listings/${id}/buy-request`, { method: 'POST' }),

  seller: (id) => request(`/api/sellers/${id}`),

  reviewSeller: (id, body) =>
    request(`/api/sellers/${id}/reviews`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),

  siteReviews: () => request('/api/site-reviews'),

  postSiteReview: (body) =>
    request('/api/site-reviews', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),

  translate: (id, to) =>
    request(`/api/listings/${id}/translate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ to }),
    }),

  contact: (body) =>
    request('/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),

  admin: {
    login: (password) =>
      request('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      }),

    analytics: (token) =>
      request('/api/admin/analytics', { headers: { authorization: `Bearer ${token}` } }),

    listings: (token, status) =>
      request(`/api/admin/listings?status=${encodeURIComponent(status)}`, {
        headers: { authorization: `Bearer ${token}` },
      }),

    approve: (token, id) =>
      request(`/api/admin/listings/${id}/approve`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      }),

    reject: (token, id, reason) =>
      request(`/api/admin/listings/${id}/reject`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ reason }),
      }),

    trustSeller: (token, id, trusted) =>
      request(`/api/admin/sellers/${id}/trust`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ trusted }),
      }),

    reviews: (token) => request('/api/admin/reviews', { headers: { authorization: `Bearer ${token}` } }),

    siteReviewAction: (token, id, action) =>
      request(`/api/admin/site-reviews/${id}/${action}`, { method: 'POST', headers: { authorization: `Bearer ${token}` } }),

    deleteSellerReview: (token, id) =>
      request(`/api/admin/seller-reviews/${id}`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } }),

    reports: (token) =>
      request('/api/admin/reports', { headers: { authorization: `Bearer ${token}` } }),

    dismissReport: (token, id) =>
      request(`/api/admin/reports/${id}/dismiss`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      }),

    remove: (token, id) =>
      request(`/api/admin/listings/${id}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` },
      }),

    /** Downloads the database backup as a file. Resolves once the browser has it. */
    downloadBackup: async (token) => {
      const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
      const response = await fetch(`${base}/api/admin/backup`, { headers: { authorization: `Bearer ${token}` } });
      if (!response.ok) throw new ApiError(response.status, null);
      const name = /filename="([^"]+)"/.exec(response.headers.get('content-disposition') || '')?.[1] || 'vong-backup.db.gz';
      const url = URL.createObjectURL(await response.blob());
      const link = Object.assign(document.createElement('a'), { href: url, download: name });
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    },

    emailBackup: (token) =>
      request('/api/admin/backup/email', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      }),

    settings: (token) =>
      request('/api/admin/settings', { headers: { authorization: `Bearer ${token}` } }),

    saveSettings: (token, patch) =>
      request('/api/admin/settings', {
        method: 'PUT',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      }),

    promoCodes: (token) =>
      request('/api/admin/promo-codes', { headers: { authorization: `Bearer ${token}` } }),

    createPromo: (token, body) =>
      request('/api/admin/promo-codes', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),

    setPromoActive: (token, code, active) =>
      request(`/api/admin/promo-codes/${encodeURIComponent(code)}`, {
        method: 'PATCH',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ active }),
      }),

    messages: (token) =>
      request('/api/admin/messages', { headers: { authorization: `Bearer ${token}` } }),

    replyMessage: (token, id, body) =>
      request(`/api/admin/messages/${id}/reply`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ body }),
      }),
  },
};
