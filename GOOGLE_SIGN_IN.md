# Google sign-in

Vòng signs people in with their Google account. The code is finished: the site
shows Google's button, the server checks what Google sends back, and a session
lasts seven days. What it needs from you is a **client ID**, a public
identifier Google issues for your site. This guide goes from nothing to anyone
signing in on the live site.

It takes about 15 minutes and a Google account.

1. [How it works](#1-how-it-works)
2. [Create the client ID](#2-create-the-client-id)
3. [Turn it on on your computer](#3-turn-it-on-on-your-computer)
4. [Turn it on on the live site](#4-turn-it-on-on-the-live-site)
5. [Let everyone sign in](#5-let-everyone-sign-in)
6. [Check it works](#6-check-it-works)
7. [When something goes wrong](#7-when-something-goes-wrong)
8. [Looking after it](#8-looking-after-it)
9. [Reference](#9-reference)

---

## 1. How it works

1. The page asks the server for the client ID (`GET /api/auth/config`). If
   there is none, the sign-in dialog says "Sign-in is not available yet".
2. The page loads Google's script from `accounts.google.com` and draws the
   **Continue with Google** button.
3. The person picks an account in Google's popup. Google gives the page an
   **ID token**: a short message, signed by Google, saying "this is Google
   account 1234, email linh@gmail.com, issued for Vòng's client ID".
4. The page sends the token to `POST /api/auth/google`.
5. The server:
   - checks the request came from an allowed address (`CORS_ORIGIN`) and
     carries Vòng's `X-Vong-Request` header, so another site cannot sign
     someone in behind their back;
   - checks Google's signature, that the token was issued for **your** client
     ID, that it has not expired, and that the email is verified;
   - creates the account on first sign-in, keyed by Google's permanent account
     number (someone who changes their Gmail address keeps the same Vòng
     account), or refreshes the name, email and photo;
   - starts a seven-day session in a cookie named `vong_session`, which page
     JavaScript cannot read.
6. Every later request carries the cookie. **Sign out** deletes the session on
   the server.

Vòng stores each person's name, email, photo URL and Google account number
(the `users` table) and a hash of each session token (`user_sessions`). It
never sees Google passwords and gets no access to Gmail, Drive or anything
else: sign-in asks Google only for name, email and photo.

There is no client secret. The client ID is public by design (anyone can read
it in the page), and Google only honours it on the addresses you list in
[step 2.4](#24-create-the-client).

---

## 2. Create the client ID

Do this once. One client ID serves your computer and the live site.

### 2.1 Pick a project

Go to https://console.cloud.google.com and sign in. Open the project picker at
the top left, choose **New project**, name it `Vong`, and **Create**. Make
sure it is the selected project before continuing.

### 2.2 Set up the consent screen

Open the menu → **Google Auth Platform** (also reached through APIs &
Services → OAuth consent screen). If you see **Get started**, click it and
fill in:

- **App information:** app name `Vòng`; user support email: yours.
- **Audience:** **External**. (Internal only admits people in your own Google
  Workspace organisation.)
- **Contact information:** your email.

Accept the policy and **Create**. Leave the logo empty for now (see
[section 5](#5-let-everyone-sign-in)).

Nothing is needed under **Data Access**. Sign-in uses the basic `openid`,
`email` and `profile` scopes, which are always allowed.

### 2.3 Add test users

Go to **Google Auth Platform → Audience**. A new app is in **Testing**: only
accounts on its **Test users** list can sign in (up to 100). Anyone else sees
"Access blocked: … has not completed the Google verification process".

Click **Add users** and add:

- your own Google account;
- a second account (a spare, or a friend's) to test buyer–seller messages.

You open it to everyone in [section 5](#5-let-everyone-sign-in).

### 2.4 Create the client

Go to **Google Auth Platform → Clients → Create client**:

- **Application type:** Web application
- **Name:** `Vong web` (only you see it)
- **Authorized JavaScript origins:** one entry per address the site is opened
  from:

  | Where you open Vòng | Add |
  |---|---|
  | `npm run dev` | `http://localhost` **and** `http://localhost:5173` |
  | `npm start` on your computer | `http://localhost:4000` |
  | The live site | its exact address, e.g. `https://vong.onrender.com` |
  | Your own domain | `https://vong.vn`, plus `https://www.vong.vn` if that is used too |

- **Authorized redirect URIs:** leave empty. Vòng's sign-in does not redirect.

Click **Create**.

Google's rules for origins:

- Scheme, host and port only. No path and no trailing slash:
  `https://vong.vn` is right, `https://vong.vn/` is not.
- `https://` everywhere except `localhost`.
- No IP addresses (such as `http://192.168.1.14:5173`) and no wildcards.
- `localhost` and `127.0.0.1` count as different addresses. Always open the
  site as `http://localhost:5173`.

If you do not know the live address yet, create the client with the localhost
entries and add the live one in [section 4](#4-turn-it-on-on-the-live-site).
Google says changes can take from five minutes to a few hours to apply.

If Google says a domain must first be added to **authorized domains**, add it
under **Branding → Authorized domains**, save, and try again. For a Render
address, use the full `vong.onrender.com` rather than `onrender.com`, which
every Render site shares.

### 2.5 Copy the client ID

The dialog shows a **Client ID** ending in `.apps.googleusercontent.com`,
and a **Client secret** starting with `GOCSPX-`. Copy the **Client ID**.
Vòng does not use the secret; never put it in the site. The client ID stays
on the **Clients** page if you need it again.

---

## 3. Turn it on on your computer

1. In the repo folder, create `.env` if you have not already:

   ```bash
   cp .env.example .env
   ```

2. Open `.env` at the top of the repo (not `client/.env`) and set:

   ```
   GOOGLE_CLIENT_ID=1234567890-abc123def456.apps.googleusercontent.com
   ```

   No quotes are needed.

3. Stop `npm run dev` (Ctrl+C) and start it again. The server reads `.env`
   only when it starts; `npm run dev` restarts it when code changes, not when
   `.env` changes.

4. The terminal must **not** print `⚠ GOOGLE_CLIENT_ID is not set` or
   `⚠ GOOGLE_CLIENT_ID does not end in .apps.googleusercontent.com`.

5. Open http://localhost:5173, click **Sign in → Continue with Google**, and
   pick a test user. The header now shows your first name and photo.

**Using `npm start` instead** (the built site on one port): run
`npm run build && npm start`, open http://localhost:4000, and make sure
`http://localhost:4000` is in the client's origins.

**On your phone:** Google refuses IP addresses, so sign-in cannot work through
`npm run dev:host` (`http://192.168.x.x:5173`). Test sign-in on your phone
against the live HTTPS site.

---

## 4. Turn it on on the live site

The live site needs the full Node server, not the static Vercel demo (see
[DEPLOY.md](DEPLOY.md)). On any host, the server needs:

| Setting | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | the client ID from [step 2.5](#25-copy-the-client-id) |
| `CORS_ORIGIN` | the site's exact public address, e.g. `https://vong.onrender.com`. For several, separate them with commas: `https://vong.vn,https://www.vong.vn` |
| `NODE_ENV` | `production`, which makes the session cookie HTTPS-only |

`CORS_ORIGIN` is required. Without it, the server rejects sign-in (and every
other form) from the live address, and prints `⚠ CORS_ORIGIN is not set` at
startup.

The same address must also be in the client's **Authorized JavaScript
origins**. The two lists do different jobs: Google's decides where the button
works, and `CORS_ORIGIN` decides which pages Vòng's server accepts sign-ins
from.

### Render

1. Create the service from the blueprint, as in [DEPLOY.md](DEPLOY.md). When
   Render asks for `GOOGLE_CLIENT_ID`, paste the client ID. For
   `CORS_ORIGIN`, enter `https://<service name>.onrender.com` (Render adds a
   suffix if that name is taken; you can fix it in step 3).
2. When the first deploy finishes, copy the address shown at the top of the
   service page.
3. In Render, open your service → **Environment**, and set `CORS_ORIGIN` to
   exactly that address. Save; Render redeploys.
4. In Google Auth Platform → **Clients** → your client, under **Authorized
   JavaScript origins**, click **Add URI**, enter the same address, and
   **Save**.
5. Open the service's **Logs** and check that no `⚠ GOOGLE_CLIENT_ID` or
   `⚠ CORS_ORIGIN` line appears.

`render.yaml` already sets `NODE_ENV=production` and `TRUST_PROXY_HOPS=1`.

### Docker or a plain VPS

Put HTTPS in front with Caddy or nginx. Google requires HTTPS, and the session
cookie is HTTPS-only in production. A complete Caddy config:

```
vong.vn, www.vong.vn {
  reverse_proxy localhost:4000
}
```

Then run the container:

```bash
docker build -t vong .
docker run -d --name vong --restart unless-stopped -p 127.0.0.1:4000:4000 -v vong-data:/data \
  -e ADMIN_PASSWORD='…' \
  -e GOOGLE_CLIENT_ID='…apps.googleusercontent.com' \
  -e CORS_ORIGIN='https://vong.vn,https://www.vong.vn' \
  -e TRUST_PROXY_HOPS=1 \
  vong
```

Without Docker, put the same values in `.env`, plus `NODE_ENV=production`.

Set `TRUST_PROXY_HOPS=1` when exactly one proxy sits in front. Without it, the
server sees every visitor as the proxy's address. The sign-in limit (30
attempts per 15 minutes per address) is then shared by your entire site.

### Adding your own domain later

Add the new address to both `CORS_ORIGIN` (comma-separated) and the client's
origins. Keep the old address in both for as long as people use it.

---

## 5. Let everyone sign in

While the app is in Testing, only test users can sign in. When you are ready,
go to **Google Auth Platform → Audience → Publish app** and confirm. The
status changes to **In production**, and any Google account can sign in
immediately. No review is required, because Vòng asks only for name, email
and photo.

Google shows your app's name and logo on its sign-in screen only after
**brand verification**. Until then it may show your site's address instead of
"Vòng". Brand verification is optional and free. It needs a home page and a
privacy policy on a domain you have proven you own in Google Search Console,
so it makes most sense once you have your own domain. Uploading a logo under
Branding starts it.

---

## 6. Check it works

On the live site, after [section 4](#4-turn-it-on-on-the-live-site):

- [ ] The server log has no `⚠ GOOGLE_CLIENT_ID` or `⚠ CORS_ORIGIN` line.
- [ ] `https://<your site>/api/auth/config` shows your client ID.
- [ ] **Sign in** works, and the header shows your name and photo.
- [ ] After a reload you are still signed in.
- [ ] **Sell** shows the form, not "Sign in to sell your first item".
- [ ] In another browser (or a private window), the second account signs in,
      opens a published listing and messages the seller. The first account
      sees the message and replies.
- [ ] After signing out and reloading, you are signed out and **Messages**
      asks you to sign in.
- [ ] Sign-in works on your phone.
- [ ] After [publishing](#5-let-everyone-sign-in), an account that is not a
      test user can sign in.

---

## 7. When something goes wrong

Three places show the real cause:

- **Browser console** (F12 → Console). Google's script reports problems as
  `[GSI_LOGGER]: …`.
- **Network tab** (F12 → Network, filter `auth`). The status of
  `POST /api/auth/google` shows whether Vòng's server refused the sign-in.
- **Server log.** Startup warnings start with `⚠`, and every token the server
  refuses logs `[auth] Google sign-in rejected: <reason>`.

| What you see | Why | Fix |
|---|---|---|
| The dialog says **"Sign-in is not available yet"** | The server has no client ID: it is unset, in the wrong file, the server was not restarted, or you are on the static Vercel demo | Set `GOOGLE_CLIENT_ID` in the root `.env` or the host's settings and restart. `/api/auth/config` must show it |
| An empty space where the button should be, and the console says **"The given origin is not allowed for the given client ID"** | This exact address is not in the client's origins | Add it exactly (scheme, host and port), wait a few minutes, then reload. For `npm run dev`, add both `http://localhost` and `http://localhost:5173` |
| The console says **"The given client ID is not found"**, or the popup shows **Error 401: invalid_client** | The client ID has a typo, or the client was deleted | Copy the client ID again from **Clients** |
| **"Google sign-in could not load"** | The browser could not download Google's script: offline, an ad or tracker blocker, strict privacy settings, or a firewall | Allow `accounts.google.com`, or try another browser |
| The popup says **"Access blocked … has not completed the Google verification process"** (Error 403: access_denied) | The app is in Testing and this account is not a test user | Add the account under **Audience → Test users**, or [publish](#5-let-everyone-sign-in) |
| You pick an account, the popup closes, and Vòng says **"Sign-in didn't go through"** | Vòng's server refused the token | Check the status of `POST /api/auth/google` in the table below |
| You pick an account, the popup closes, and **nothing happens** | A proxy or CDN in front of the site sends `Cross-Origin-Opener-Policy: same-origin`, which cuts the popup off from the page | Vòng sends `same-origin-allow-popups`. Remove the stricter header from the proxy |
| Signed in, but **signed out again after a reload**, or Sell says to sign in | The browser did not keep the session cookie. The live site is on plain `http://` (the cookie is HTTPS-only in production), the API is on a different domain, or a proxy strips cookies | Serve the site and the API from one HTTPS address ([section 4](#4-turn-it-on-on-the-live-site)). For a separate API, see [ACCOUNTS.md](ACCOUNTS.md) |
| Sign-in fails on your phone through `npm run dev:host` | Google does not allow IP addresses | Expected. Test on the live site |
| `localhost:5173` works but `127.0.0.1:5173` does not | They are different addresses to Google and to Vòng | Use `localhost` |
| A change to `.env` has no effect | The server reads `.env` only at startup | Restart the server |

When Vòng's server refuses the token, the status of `POST /api/auth/google`
narrows it down:

| Status | Server log / meaning | Fix |
|---|---|---|
| `403 invalid_request_origin` | The page's address is not in `CORS_ORIGIN`. Without `CORS_ORIGIN`, only `http://localhost:5173`, `:5174` and `:4000` are allowed | Set `CORS_ORIGIN` to exactly the address in the browser's address bar, then restart |
| `401 invalid_credential`, log says **Wrong recipient** | The server's `GOOGLE_CLIENT_ID` differs from the one the page used, for example after a change without a restart | Make every server use the same value, then restart |
| `401`, log says **Token used too late** or **too early** | The server's clock is wrong | Turn on automatic time sync (NTP) |
| `401`, log says **Failed to retrieve verification certificates** | The server cannot download Google's signing keys | Allow outbound HTTPS to `www.googleapis.com` |
| `401`, log says **account has no verified email** | That Google account has no verified email | The person must verify their email with Google |
| `429 too_many_attempts` | More than 30 attempts in 15 minutes from one address | Wait. If it affects everyone at once, set `TRUST_PROXY_HOPS` ([section 4](#docker-or-a-plain-vps)) |
| `503 google_not_configured` | The server handling the request has no client ID | Set `GOOGLE_CLIENT_ID` and restart |

---

## 8. Looking after it

**Who has signed up.** Run this on the server (on Render: service → **Shell**).
To run it on your computer, put `DATABASE_FILE=server/data/vong.db` in front
of the command.

```bash
node -e "const db = require('better-sqlite3')(process.env.DATABASE_FILE); console.table(db.prepare('SELECT name, email, created_at FROM users ORDER BY created_at').all())"
```

**Sign everyone out**, for example if you think a session was stolen:

```bash
node -e "const db = require('better-sqlite3')(process.env.DATABASE_FILE); console.log(db.prepare('DELETE FROM user_sessions').run().changes, 'sessions ended')"
```

**Sessions do not depend on Google once someone is signed in.** Changing or
deleting the Google client does not sign anyone out, and signing out of Google
does not sign someone out of Vòng. A session ends after seven days, on
**Sign out**, or with the command above.

**Replacing the client ID.** Create a new client with the same origins, put
its ID in `GOOGLE_CLIENT_ID`, and restart. Accounts are keyed by Google
account, not by client, so everyone keeps their account, listings and
messages.

**Name, email and photo** refresh each time someone signs in.

**Not built yet:** automatic sign-in (Google One Tap), other sign-in methods
(Zalo, Facebook, email), signing out every device at once from the site, and
account deletion.

---

## 9. Reference

**Settings**

| Name | Where | Purpose |
|---|---|---|
| `GOOGLE_CLIENT_ID` | root `.env` or host settings | The web client ID. Unset: the sign-in button is replaced by "Sign-in is not available yet" |
| `CORS_ORIGIN` | root `.env` or host settings | Addresses allowed to sign in and post forms, comma-separated. Required in production. Unset: `http://localhost:5173`, `:5174` and `:4000` (or `PORT`) |
| `NODE_ENV` | host settings | `production` makes the session cookie HTTPS-only |
| `TRUST_PROXY_HOPS` | host settings | Number of proxies in front, so rate limits apply per visitor. `1` on Render and behind one Caddy or nginx |
| `VITE_API_BASE_URL` | `client/.env`, at build time | Only for an API on a separate subdomain. See [ACCOUNTS.md](ACCOUNTS.md) |

**Endpoints:** `GET /api/auth/config` (client ID), `GET /api/auth/me` (current
profile or `null`), `POST /api/auth/google` (sign in with `{ credential }`),
`POST /api/auth/logout`.

**Session cookie:** `vong_session`, HttpOnly, SameSite=Lax, Path=/api,
Secure in production, seven days.

**Code:** `server/src/accounts.js` (server side),
`client/src/lib/auth.jsx` and `client/src/components/SignInDialog.jsx`
(browser side). The tests in `server/src/accounts.test.js` run with
`npm test`.
