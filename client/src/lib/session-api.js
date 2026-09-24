const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export async function sessionRequest(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'X-Vong-Request': '1', ...options.headers },
  });
  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json() : null;
  if (!response.ok || !payload) {
    const error = new Error(payload?.error || 'service_unavailable');
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

const post = (path, body = {}) => sessionRequest(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export const sessionApi = {
  config: () => sessionRequest('/api/auth/config'),
  me: () => sessionRequest('/api/auth/me'),
  google: (credential) => post('/api/auth/google', { credential }),
  logout: () => post('/api/auth/logout'),
  inbox: () => sessionRequest('/api/conversations'),
  start: (listingId) => post('/api/conversations', { listingId }),
  messages: (id, cursor = {}) => sessionRequest(`/api/conversations/${encodeURIComponent(id)}/messages?${new URLSearchParams(cursor)}`),
  send: (id, body, clientId) => post(`/api/conversations/${encodeURIComponent(id)}/messages`, { body, clientId }),
};
