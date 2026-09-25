# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Anyone in Ho Chi Minh City buying or selling secondhand things: furniture, clothes, electronics, books, household goods and hobby gear. Mostly on phones, in Vietnamese or English. Sellers are clearing space (moving, upgrading, tidying); buyers want useful things nearby at a fair price.

## Product Purpose

Vòng is a local secondhand marketplace. A seller signs in with Google, lists an item, pays a small flat fee by bank transfer, a person approves it, and the seller publishes it with a one-time key emailed to them. Buyers browse and search by category and district, then message the seller privately. Success is real items getting listed and changing hands between people in the same city.

## Positioning

One flat listing fee (10,000 ₫ by default) and nothing else: no commission on the sale, and Vòng never holds the buyer's money (doing so would need a State Bank payment licence). Buyers and sellers talk in private in-app chat and arrange payment and pickup themselves. Every screen works in Vietnamese and English.

## Operating Context

- Google sign-in for buyers and sellers. A conversation is visible only to its buyer and seller.
- The listing fee is paid by VietQR bank transfer. An admin checks the bank app and approves; the seller then enters the emailed publish key to go live.
- Districts: District 1, District 3, District 7, Bình Thạnh, Thảo Điền. Categories: furniture, clothing, electronics, books, household, hobby. Conditions: like new, good, fair, well used.
- Prices are in đồng (₫), digit grouping follows the interface language.

## Capabilities and Constraints

- React + Vite frontend, Express + SQLite API. Every visible string lives in `client/src/i18n/en.js` and `client/src/i18n/vi.js` with matching keys.
- One photo per listing. Saved items live in the visitor's browser. Sellers cannot edit or delete listings yet.
- Phones first (390 px wide), desktop second.
- Light theme only. Dark mode was not kept in the redesign.

## Brand Commitments

- The name Vòng and the single-stroke V loop mark (`client/src/components/Logo.jsx`, `client/public/favicon.svg`).
- Vietnamese and English on every screen, switchable from the header.
- The owner asked for lighter colors, better fonts, and for every AI-generated look and AI-sounding phrase to be removed.

## Evidence on Hand

- No listings yet: the marketplace starts empty. No sample listings, stock photos or AI-generated images may be added; empty states say so plainly.
- No testimonials, user counts, reviews or press exist. None may be invented.

## Product Principles

1. Real items lead: search, categories and listings come before any storytelling.
2. Plain, specific words in both languages; no marketing voice.
3. Honest states: empty, loading, waiting for approval and errors say exactly what is true.
4. The fee and "no commission" are visible wherever selling starts.

## Accessibility & Inclusion

Every font must render Vietnamese diacritics correctly. WCAG AA contrast for text and controls; touch targets at least 44 px on phones.
