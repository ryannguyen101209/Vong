# Vòng

A secondhand marketplace for Ho Chi Minh City. Sellers list for free; a listing
goes live once the seller transfers a small fee (10,000 ₫ by default), a human
confirms the transfer arrived, and the seller enters the one-time key we email
them. Vòng takes no commission and never touches the buyer's money.

Fully bilingual (English / Tiếng Việt), light and dark themes, mobile first.

Google sign-in is verified by the server, and buyer–seller conversations are
stored in the database with participant-only access. New listings require a
signed-in seller. See [ACCOUNTS.md](ACCOUNTS.md) for activation and verification.

There is no sample inventory and no generated imagery. When nobody has listed
anything, the site says so and invites the first seller.

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

# 3. Configure GOOGLE_CLIENT_ID in .env for sign-in, and optionally the
#    SMTP_* settings so publish keys are emailed (see "Emailing publish keys").

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
| `npm run build` | Builds the website into `client/dist/` for deployment. |
| `npm start` | Runs the API and serves the built website from one port (4000). |
| `npm test` | Checks the VietQR generator, accounts and messaging, and the approval key flow. |

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

1. Sign in with Google, go to **Sell**, fill in the form, submit. The email
   field starts as your Google address; the publish key will be sent there.
2. You land on the **payment page** with a real VietQR code. Scan it with your
   banking app to check the amount and the transfer note appear correctly.
   **Don't actually pay yourself** — just look at the confirmation screen.
3. Press **"I've sent the payment"**. The listing moves to `awaiting_approval`.
4. Go to **/admin**, sign in. The listing is in the queue with the exact amount
   and reference code to look for in your bank app.
5. Press **Approve & send key**. Vòng generates a one-time key (like `K7RD-M4XP`)
   and emails it to the seller. If email is not set up, the key is shown to you
   with a button that opens a prefilled email in your own mail app.
6. As the seller, open **Your listings** (account menu → Your listings). The
   listing says *Approved — enter key*. Type the key into the key box and press
   **Publish listing**. It now appears on Browse.
7. Or, in step 5, press **Reject** and write a reason; the seller sees that
   reason on their listing page (and gets it by email when email is set up).

A listing's life: `pending_payment` → `awaiting_approval` → `approved` → `published`,
or `rejected`. A rejected seller can press "I've sent the payment" again to
re-enter the queue.

The key is stored only as a hash, works for 7 days, and locks after 5 wrong
tries. The seller can ask for a new one from the key box (when email is set up),
and the admin can resend it from **All listings → Approved — enter key**.

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
        ├── db.js          database schema and settings
        ├── vietqr.js      the VietQR / EMVCo payload builder
        ├── catalog.js     categories, districts and conditions
        ├── accounts.js    Google sign-in and sessions
        ├── publish-key.js the emailed one-time key that publishes a listing
        ├── mailer.js      SMTP email (optional)
        └── routes/        listings.js, conversations.js and admin.js (password-gated)
```

**Why this stack:** Vite gives an instant dev server and builds to plain static
files you can host anywhere. A separate Express API keeps the payment and admin
logic in one readable place. SQLite is a single file — no database to install,
no Docker. When you outgrow it, the queries live in two route files and port to
Postgres without touching the frontend.

### Where things are stored

- **Listings, settings, contact messages** — `server/data/vong.db` (SQLite).
  Delete that file to start completely fresh.
- **Uploaded photos** — `server/uploads/listings/`.
- **Saved items** — your visitor's browser (`localStorage`), not the server.
  Saved items are not yet synced to accounts, so they do not follow someone
  to another phone.
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

**Emailing publish keys.** When you approve a listing, the seller's key is
emailed over SMTP, in the language they wrote the listing in. Any mail provider
works. With a Gmail account: turn on 2-Step Verification, create an **App
password** (Google Account → Security → App passwords), and set in `.env`:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=you@gmail.com
SMTP_PASS=the-16-character-app-password
MAIL_FROM="Vòng <you@gmail.com>"
PUBLIC_URL=https://your-domain.com
```

Resend, SendGrid, Brevo and Zoho all give you the same five values. Admin →
Settings says whether email is connected. Rejection reasons are emailed too.

Without SMTP nothing is sent automatically, and nothing is faked: after you
approve, the admin page shows the key with an **Email the seller** button that
opens a prefilled draft in your own mail app. You press send.

Seller emails are stored but never sent to the browser on public pages — an
address on a public listing page is a spam magnet. Only the seller and the admin
views see them.

**Contact form messages are not emailed either.** They save to the database and
print to the server log; you read them in the admin Settings tab.

**Google accounts and private messaging are implemented.** Deploy the full Node
backend and configure `GOOGLE_CLIENT_ID` to activate them. Signed-in sellers see
all their listings, and what each needs next, under **Your listings**. Saved
items still live in one browser, and sellers cannot edit/delete their listings
yet. New listings are owned by the signed-in account; old listings are not
automatically claimed.

**Admin auth is one shared password** held in memory, so everyone signs out when
the server restarts. Fine for one person. If a second person starts approving
listings, give them real accounts.

**Buyer–seller messaging is stored on the server.** An inbox lists the account's
conversations; messages refresh every three seconds while open, and the header
shows a count of unread messages. Only the buyer and seller can access each
conversation. Email notifications for new messages, read receipts and
blocking/reporting tools are not implemented.

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
need one process. Put nginx or Caddy in front for HTTPS, and set `ADMIN_PASSWORD`,
`CORS_ORIGIN`, `GOOGLE_CLIENT_ID` and the `SMTP_*` / `PUBLIC_URL` settings in `.env`.

Before you go live:

- [ ] Set a real `ADMIN_PASSWORD` in `.env` (the app warns you on every start until you do).
- [ ] Put your real bank details in /admin → Settings.
- [ ] Set up SMTP and approve a test listing to check the key email arrives.
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
