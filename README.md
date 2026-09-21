# Vòng

A secondhand marketplace for Ho Chi Minh City. Sellers list for free; a listing
goes live once the seller transfers a small fee (10,000 ₫ by default) and a human
confirms the transfer arrived. Vòng takes no commission and never touches the
buyer's money.

Fully bilingual (English / Tiếng Việt), light and dark themes, mobile first.

The frontend now includes a Google Identity Services entry point and a
conversation prototype. Add `VITE_GOOGLE_CLIENT_ID` in `client/.env` to render
the official Google sign-in button. Credentials are not yet verified by the
server, and messages remain on the current device until the account and
messaging backend is added.

---

## Run it on your own computer

You need **Node.js 20 or newer**. Check with `node --version`; if that errors,
install it from [nodejs.org](https://nodejs.org).

```bash
# 1. Install everything (frontend + backend in one go)
npm install

# 2. Set your admin password
cp .env.example .env
#    open .env and change ADMIN_PASSWORD to something only you know

# 3. Load the 10 sample listings
npm run seed

# 4. Start both the API and the website
npm run dev
```

Then open **http://localhost:5173**.

The admin page is at **http://localhost:5173/admin** — sign in with the
`ADMIN_PASSWORD` from your `.env`.

### The other commands

| Command | What it does |
|---|---|
| `npm run dev` | Runs the API (port 4000) and the website (port 5173) together. |
| `npm run dev:host` | Same, but also serves the site to your Wi-Fi network so you can open it on your phone. Vite prints a `Network:` address — use that one. |
| `npm run seed` | Loads the 10 sample listings. Safe to run twice. |
| `npm run reset` | Deletes the sample listings and reloads them. Your own listings are left alone. |
| `npm run build` | Builds the website into `client/dist/` for deployment. |
| `npm start` | Runs the API and serves the built website from one port (4000). |
| `npm test` | Checks the VietQR generator against known values. |

---

## Testing it on your phone

The site is built mobile first, so this is worth doing. Your phone and your
computer must be on **the same Wi-Fi**.

```bash
npm run dev:host
```

Vite prints two addresses. Use the **Network** one:

```
Local:   http://localhost:5173/
Network: http://192.168.1.14:5173/      <- type this into your phone
```

Your number will be different. If no `Network:` line appears, your computer is
offline or on a network that blocks it.

If the phone cannot load the page, it is almost always your computer's firewall:

- **Windows:** the first time you run it, a Windows Defender Firewall popup asks
  whether to allow Node.js. Tick **Private networks** and allow it. If you
  dismissed it, go to Windows Security -> Firewall -> Allow an app, and allow Node.
- **Mac:** System Settings -> Network -> Firewall -> Options, and allow incoming
  connections for Node.

Cafe and university Wi-Fi often use "client isolation", which stops devices on
the network from seeing each other no matter how you configure your laptop. Use
a home network or your phone's hotspot instead.

---

## Trying the whole flow

Worth doing once so you know what your sellers will see:

1. Go to **Sell**, fill in the form, submit.
2. You land on the **payment page** with a real VietQR code. Scan it with your
   banking app to check the amount and the transfer note appear correctly.
   **Don't actually pay yourself** — just look at the confirmation screen.
3. Press **"I've sent the payment"**. The listing moves to `awaiting_approval`.
4. Go to **/admin**, sign in. The listing is in the queue with the exact amount
   and reference code to look for in your bank app.
5. Press **Approve** — the listing appears on Browse. Or press **Reject** and
   write a reason; the seller sees that reason on their payment page.

A listing's life: `pending_payment` → `awaiting_approval` → `published` or `rejected`.
A rejected seller can press "I've sent the payment" again to re-enter the queue.

---

## How it's built

```
vong/
├── client/              React + Vite website
│   └── src/
│       ├── i18n/        en.js and vi.js — EVERY visible string lives here
│       ├── pages/       one file per page
│       ├── components/  header, footer, cards, dialogs, the logo
│       ├── lib/         api calls, formatting, saved items, theme, your contact details
│       └── styles.css   the whole design system (colours, type, layout)
└── server/              Express API + SQLite
    └── src/
        ├── db.js        database schema and settings
        ├── vietqr.js    the VietQR / EMVCo payload builder
        ├── seed-data.js the 10 sample listings, both languages
        ├── placeholders.js  generates the sample listing illustrations
        └── routes/      listings.js (public) and admin.js (password-gated)
```

**Why this stack:** Vite gives an instant dev server and builds to plain static
files you can host anywhere. A separate Express API keeps the payment and admin
logic in one readable place. SQLite is a single file — no database to install,
no Docker. When you outgrow it, the queries live in two route files and port to
Postgres without touching the frontend.

### Where things are stored

- **Listings, settings, contact messages** — `server/data/vong.db` (SQLite).
  Delete that file to start completely fresh.
- **Uploaded photos** — `server/uploads/listings/`. Sample illustrations are in
  `server/uploads/seed/`.
- **Saved items** — your visitor's browser (`localStorage`), not the server.
  There are no user accounts yet, so there is nobody to attach them to. This
  means saved items don't follow someone to another phone.
- **Language and theme choice** — also `localStorage`.

---

## The VietQR code

`server/src/vietqr.js` builds a genuine EMVCo payload: tag-length-value fields,
the NAPAS GUID `A000000727`, your bank's 6-digit BIN, your account number, the
amount, the reference note, and a CRC-16/CCITT-FALSE checksum. `npm test`
verifies the structure and the checksum against known values.

**Before you take real money, do this:** open `/admin` → Settings, put in your
real bank, account number and account holder name, then scan the QR on a listing
with your own banking app and confirm it pre-fills the right account and amount.
The bank BIN list in `vietqr.js` is accurate at the time of writing but you
should confirm your own bank's BIN against
[napas.com.vn](https://napas.com.vn) or [vietqr.io](https://vietqr.io).

---

## Editing the text

Every string in the interface comes from `client/src/i18n/en.js` and
`client/src/i18n/vi.js`. The two files have identical key structures — change a
string in one, change it in the other. Nothing is hardcoded in a component, so
you never have to hunt through JSX to reword something.

Your public contact details (Zalo number, email shown on the Contact page) are
in `client/src/lib/site.js` — **these are placeholders, change them.**

The colours, fonts and spacing are all CSS variables at the top of
`client/src/styles.css`.

---

## What is stubbed, and what you'd need to make it real

I have not faked any of these. Each one is a genuine gap, with what it would take:

**Payment confirmation is manual — by design.** Nothing detects incoming
transfers. You look at your bank app and click Approve. To automate it you would
need a bank API or a payment gateway (Casso, PayOS and SePay all offer webhooks
that fire on an incoming transfer), then match the webhook's transfer note
against the listing's reference code and approve automatically. Until then, the
queue is the product.

**Nothing is emailed automatically.** Sellers now give an email address when
they post, and the admin queue shows it. After you approve or reject a listing,
an "Email the seller" button appears that opens a **prefilled draft in your own
mail app** — the right message, the listing title, the link and the reference
code already filled in. You press send. That is a deliberate stopgap, not a
pretence: the app itself sends nothing.

To make it automatic you need a mail service — Resend and SendGrid both have
free tiers big enough for a project this size. It is roughly an afternoon's
work: add the API key to `.env`, and call the service from the approve and
reject handlers in `server/src/routes/admin.js`, where the seller's email is
already loaded. The message templates are already written, in both languages,
in the `admin.emailApprovedBody` / `admin.emailRejectedBody` keys of
`client/src/i18n/`.

Seller emails are stored but never sent to the browser on public pages — an
address on a public listing page is a spam magnet. Only the admin views see them.

**Contact form messages are not emailed either.** They save to the database and
print to the server log; you read them in the admin Settings tab.

**No user accounts.** Sellers cannot edit or delete their own listings, and
saved items live in one browser. This is why the FAQ tells people to contact you
with their reference code. Adding accounts means a users table, password hashing,
and sessions — a real chunk of work, worth doing only once you have sellers
asking for it.

**Admin auth is one shared password** held in memory, so everyone signs out when
the server restarts. Fine for one person. If a second person starts approving
listings, give them real accounts.

**Buyer and seller have no messaging.** "Request to buy" reveals the seller's
phone number and logs that it happened. Everything after that is Zalo. This is
deliberate — a messaging system is a large feature and people already use Zalo.

**Photos are stored on local disk.** This works in development and on a normal
VPS, but most modern hosts (Vercel, Netlify Functions, Heroku) wipe the
filesystem on every redeploy, and your photos and database would vanish. For
those, move photos to S3/Cloudflare R2 and the database to a hosted Postgres.

**One photo per listing.** The form, the API and the database all assume a single
image. Multiple photos means an images table and a gallery component.

**No moderation beyond your own eyes.** Nothing scans for prohibited items. You
see each listing in the approval queue — that is the moderation.

---

## Deploying it

**See [DEPLOY.md](DEPLOY.md) for the full walkthrough — and read it before you
try Vercel or Netlify.** Vòng is a running Node server with a database file, not
a static site, so those hosts give you a frontend with nothing behind it: empty
dropdowns and "Something went wrong" on every page.

The simplest version that keeps working: one small VPS (a $5 box is plenty),
where the disk persists.

```bash
npm install
npm run build          # builds the website into client/dist/
NODE_ENV=production npm start
```

`npm start` serves the API *and* the built website from port 4000, so you only
need one process. Put nginx or Caddy in front for HTTPS, and set `ADMIN_PASSWORD`
and `CORS_ORIGIN` in `.env`.

Before you go live:

- [ ] Set a real `ADMIN_PASSWORD` in `.env` (the app warns you on every start until you do).
- [ ] Put your real bank details in /admin → Settings.
- [ ] Scan a real QR with your own banking app and confirm it works.
- [ ] Replace the placeholder Zalo number and email in `client/src/lib/site.js`.
- [ ] Back up `server/data/vong.db` somewhere. It is your entire business.

---

## A note on the business model

Vòng charges sellers a listing fee and nothing else. It does not hold the
buyer's money at any point. That is not a shortcut — holding other people's
money in Vietnam requires a payment intermediary licence from the State Bank,
and the app is built so that the temptation never arises: there is no code path
where Vòng receives a buyer's payment. The About page and FAQ say this plainly
to users, in both languages.

Built by three students in Saigon.
