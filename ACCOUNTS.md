# Accounts and buyer–seller messaging

## What is implemented

Google Identity Services returns an ID token to the browser. The API verifies its signature, audience, issuer and expiry with Google's official `google-auth-library`; it also requires a verified email. Google subject IDs identify accounts. Browser-decoded claims are never trusted.

The API creates a seven-day random session stored as a hash in SQLite and sent in an HttpOnly cookie (Secure in production). Logout invalidates the server session. Mutations require a custom request header and an allowed Origin; CORS uses an explicit allowlist.

New listings require authentication and store the seller account ID. The seller gives the email their publish key goes to; it defaults to their verified Google address. Old listings are not claimed based on matching email. Payment information, marking a listing paid, and entering the publish key require its owner.

Publishing takes two steps: an admin approves the listing after checking the transfer, which generates a one-time key and emails it to the seller (or shows it to the admin to send by hand when SMTP is not configured). The listing goes live when its owner enters that key. Keys are stored as SHA-256 hashes, expire after 7 days, lock after 5 wrong attempts, and are replaced when resent. Signed-in sellers see all their listings and their status at `/my-listings`.

Each published listing can have one conversation per buyer. Only that buyer and the listing owner can list, read or send messages in the conversation. Messages persist in SQLite, refresh every three seconds while the conversation is open, support earlier-message pagination, and use a client request ID to avoid duplicate sends after network retries. Each side's last-read message is tracked so the header and inbox show unread counts. No email/push notifications for new messages or read receipts are included.

There is no sample inventory. Sample listings left in an older database are deleted when the server starts; real listings are preserved. The static demo starts empty and filters legacy `seed-*` records from browser storage.

## Activate on a real host

1. Deploy the full Node application using `render.yaml` (or the Dockerfile), with persistent storage. Run `npm install && npm run build` and `npm start`.
2. Set `ADMIN_PASSWORD`, `GOOGLE_CLIENT_ID`, and `CORS_ORIGIN` to the site's exact public HTTPS origin. Set `NODE_ENV=production`. Keep `DATABASE_FILE` and `UPLOADS_DIR` on the persistent disk. For emailed publish keys, also set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` and `PUBLIC_URL` (see `.env.example`).
3. In Google Cloud, create an OAuth client of type **Web application** and add that exact origin under **Authorized JavaScript origins**. Add `http://localhost:5174` if testing locally. Configure the consent screen and test users or production publishing as appropriate.
4. Open the deployed site and sign in with two separate Google accounts. Post an item from one account, approve it in admin, enter the emailed key under Your listings, and exchange messages from the other account. Confirm the unread badge appears, the conversation survives reloads, and sign-out prevents access.

Google's setup guide: https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid

The current Vercel project is a static demo. It cannot run the SQLite API. The simplest activation is to serve both the frontend and API from the full Node host under one origin. If retaining Vercel for the frontend, configure same-origin `/api/*` and `/uploads/*` reverse proxies to that host, use a normal `npm run build` (not `npm run demo`), and preserve cookies through the proxy. Do not deploy a browser-only demo and label its login or messaging as live.

`VITE_API_BASE_URL` supports a separately served API on the same site and disables demo substitution when present. Unrelated frontend/backend domains need a same-origin proxy; the session intentionally does not depend on third-party cookies. With a separate same-site API, uploaded image URLs also need an `/uploads` proxy.

## Verification

`npm test` runs the VietQR tests and isolated integration tests for accounts, messaging and approval. They inject a test-only Google verifier and mail transport, never into the running application. They test rejection, session flags/expiry, CSRF-origin checks, listing ownership, seller email, private conversation access, two-way delivery, unread counts, deduplication, pagination, sample exclusion, and the publish key: emailing, hashing, owner-only entry, attempt lock, resend, expiry, rejection, mail failure and manual delivery. Real Google consent and your SMTP provider still need testing after the deployment is configured.
