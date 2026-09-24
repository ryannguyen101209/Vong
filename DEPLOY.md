# Putting Vòng online

## Why Vercel does not work for this

Vercel hosts **static files** and short-lived **serverless functions**. Vòng is
neither: it is a Node server that stays running, holding a SQLite database file
and a folder of uploaded photos.

Deploy this repo to Vercel and you get the frontend only. Every page loads, but
nothing behind it exists, so:

- Home and Browse show **"Something went wrong"** — the listings request 404s.
- The **dropdowns on the Sell page are empty** — categories, districts and
  conditions are fetched from `/api/meta`, which is not there.
- Refreshing on any page except the home page gives a **404**, because a static
  host does not know that `/browse` should be handled by the app.

Two smaller things would still bite you even if the API did run there: Vercel's
filesystem is wiped on every deploy, so your SQLite database and every uploaded
photo would vanish each time you push.

**Delete the Vercel project** so you are not testing against a broken URL, and
use one of the options below instead.

---

## What you actually need

A host that runs a **normal Node process** and gives you a **disk that persists**.
Then one process serves both the API and the website, exactly like `npm start`
does on your laptop.

Render, Railway and Fly.io all do this, as does any small VPS. Check their
current plans yourself — free tiers change, and the free ones usually have no
persistent disk, which matters here.

---

## Deploying to Render (worked example)

This repo has a `render.yaml`, so most of it is filled in for you.

1. Push your code to GitHub (already done).
2. Go to Render → **New** → **Blueprint**, and pick your `Vong` repository.
   It reads `render.yaml` and proposes a web service with a 1GB disk.
3. It will ask for the one value not in the file: **ADMIN_PASSWORD**. Set a real
   one. Secrets never go in the repo.
4. Create the service and wait for the first build. It runs
   `npm install && npm run build`, then `npm start`.
5. Open the URL it gives you. The site is live, but **empty** — your database
   starts blank.
6. Leave the marketplace empty. Do not run the seed command. Visitors see
   “Sell the first item” until a real seller publishes a listing. Configure
   Google sign-in and messaging using [ACCOUNTS.md](ACCOUNTS.md).

7. Go to `/admin`, sign in with the password from step 3, and put your **real
   bank details** in Settings. Then scan a listing's QR with your own banking
   app and confirm it fills in correctly, **before** you tell anyone the site is
   open.

### Why the disk matters

`render.yaml` mounts a disk at `/var/vong-data` and points the database and the
uploads folder at it. Without that, every redeploy resets your site to zero
listings and deletes everyone's photos. This is the single most important part
of the config, and the easiest to leave out by accident.

---

## Deploying anywhere else

There is a `Dockerfile` for hosts that take containers (Fly.io, Railway, a VPS).
Mount a volume at `/data` and the database and uploads will live there.

On a plain VPS with no container at all:

```bash
git clone https://github.com/ryannguyen101209/Vong.git
cd Vong
npm install
npm run build
cp .env.example .env     # set ADMIN_PASSWORD
# Configure GOOGLE_CLIENT_ID and CORS_ORIGIN; start without sample listings.
npm start
```

Then put nginx or Caddy in front for HTTPS, and use `pm2` or a systemd service
so it restarts if the machine reboots.

---

## Before you share the link

- [ ] `ADMIN_PASSWORD` set to something real (the server warns on every start until you do)
- [ ] A persistent disk attached, and `DATABASE_FILE` / `UPLOADS_DIR` pointing at it
- [ ] Real bank details saved in /admin → Settings
- [ ] A test QR scanned with your own banking app
- [ ] Your Zalo number and email updated in `client/src/lib/site.js`
- [ ] `CORS_ORIGIN` in `.env` set to your domain
- [ ] A backup plan for the database file — it is your entire business

---

## Could this run on Vercel one day?

Yes, but it is a real migration, not a setting:

- Move the Express routes to serverless functions.
- Move SQLite to a hosted Postgres (Vercel Postgres, Neon, Supabase).
- Move uploaded photos to object storage (S3, Cloudflare R2, Vercel Blob).
- Add a `vercel.json` rewrite so client-side routes stop 404-ing.

That is worth doing if the site grows. It is not worth doing to get your first
ten listings online.
