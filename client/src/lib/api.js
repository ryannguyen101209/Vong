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

  listings: ({ search = '', category = '', district = '', minPrice, maxPrice, sort = 'newest', ids } = {}) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (category) params.set('category', category);
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

  buyRequest: (id) => request(`/api/listings/${id}/buy-request`, { method: 'POST' }),

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

    messages: (token) =>
      request('/api/admin/messages', { headers: { authorization: `Bearer ${token}` } }),
  },
};
