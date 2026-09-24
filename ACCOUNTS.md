# Accounts and buyer–seller messaging

## What is implemented

Google Identity Services returns an ID token to the browser. The API verifies its signature, audience, issuer and expiry with Google's official `google-auth-library`; it also requires a verified email. Google subject IDs identify accounts. Browser-decoded claims are never trusted.

The API creates a seven-day random session stored as a hash in SQLite and sent in an HttpOnly cookie (Secure in production). Logout invalidates the server session. Mutations require a custom request header and an allowed Origin; CORS uses an explicit allowlist.

New listings require authentication and store the seller account ID. Seller email comes from the verified account. Old listings are not claimed based on matching email. Payment information and marking a listing paid require its owner. Publishing still requires the existing manual admin approval.

Each published listing can have one conversation per buyer. Only that buyer and the listing owner can list, read or send messages in the conversation. Messages persist in SQLite, refresh every three seconds while the conversation is open, support earlier-message pagination, and use a client request ID to avoid duplicate sends after network retries. No email/push notifications or read receipts are included.

Sample listings are excluded from public API results and detail pages. The static demo starts empty and filters legacy `seed-*` records from browser storage. Existing real records are preserved.

## Activate on a real host

1. Deploy the full Node application using `render.yaml` (or the Dockerfile), with persistent storage. Run `npm install && npm run build` and `npm start`. Do not run `npm run seed`.
2. Set `ADMIN_PASSWORD`, `GOOGLE_CLIENT_ID`, and `CORS_ORIGIN` to the site's exact public HTTPS origin. Set `NODE_ENV=production`. Keep `DATABASE_FILE` and `UPLOADS_DIR` on the persistent disk.
3. In Google Cloud, create an OAuth client of type **Web application** and add that exact origin under **Authorized JavaScript origins**. Add `http://localhost:5174` if testing locally. Configure the consent screen and test users or production publishing as appropriate.
4. Open the deployed site and sign in with two separate Google accounts. Post an item from one account, approve the listing in admin after the configured publishing process, and exchange messages from the other account. Confirm the conversation survives reloads and sign-out prevents access.

Google's setup guide: https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid

The current Vercel project is a static demo. It cannot run the SQLite API. The simplest activation is to serve both the frontend and API from the full Node host under one origin. If retaining Vercel for the frontend, configure same-origin `/api/*` and `/uploads/*` reverse proxies to that host, use a normal `npm run build` (not `npm run demo`), and preserve cookies through the proxy. Do not deploy a browser-only demo and label its login or messaging as live.

`VITE_API_BASE_URL` supports a separately served API on the same site and disables demo substitution when present. Unrelated frontend/backend domains need a same-origin proxy; the session intentionally does not depend on third-party cookies. With a separate same-site API, uploaded image URLs also need an `/uploads` proxy.

## Verification

`npm test` runs the existing VietQR tests and isolated account/messaging integration tests. The latter inject a test-only Google verifier into the router factory, never into the running application. They test rejection, session flags/expiry, CSRF-origin checks, listing ownership, private conversation access, two-way delivery, deduplication, pagination, and sample exclusion. Real Google consent still needs testing after the deployment client ID is configured.
