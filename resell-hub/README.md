# Resell Hub

Upload photos of a thing you want to sell, get a trendy AI-written
description and a price recommendation, cross-list it, and let the app keep
track of what's sold — unlisting it everywhere else once it does.

## Quick start

```bash
cd resell-hub
npm install
cp .env.example .env   # optional — the app runs fully without any keys set
npm start
```

Open `http://localhost:3000`.

## What it actually does (read this before relying on it)

**Uploads, AI copy, and pricing** are fully real out of the box:
- Upload one or more photos plus title/category/condition/brand/size/notes.
- The app generates a trendy, marketing-ready description + hashtags and a
  price recommendation (list price + a fair range).
- If you set `ANTHROPIC_API_KEY` in `.env`, the copy is written by Claude.
  Without it, a built-in trendy-description template and a rule-based price
  estimator (category baseline × condition × a brand-demand bump) kick in
  automatically — no setup required, just less polished.

**Cross-listing is honest about what's actually possible per marketplace:**

| Marketplace | Public listing API? | What this app does |
|---|---|---|
| eBay | Yes (Sell Inventory API) | Real listing + real delisting, once you add your own `EBAY_OAUTH_TOKEN` and business policy IDs to `.env`. Without a token, it runs in **simulated** mode so you can still exercise the whole flow. |
| Vinted, Depop, Poshmark, Facebook Marketplace | **No.** None of these publish a public API that lets a third-party app create or remove listings for you. | The app generates copy-ready listing content for each one and tracks status as `ready to post → listed`, based on you confirming you posted it. This is deliberate — the alternative (driving a hidden browser to click through their site as "you") breaks those platforms' terms of service, so this app doesn't do that. |

**"Mark as sold" is the core feature and it's real for every marketplace,**
just via two different mechanisms:
- On eBay (when configured with a real token), marking an item sold calls
  the real withdraw/offer API and actually takes the listing down.
- On the manual marketplaces, marking an item sold flips their badge to
  **"Remove me!"** so you know exactly what to go pull down by hand, and you
  click "Mark removed" once you have — so nothing gets silently left up
  after it's already sold somewhere else.

## Configuration (`.env`)

See `.env.example`. Everything is optional:

- `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` — turns on AI-written descriptions.
- `EBAY_ENV`, `EBAY_OAUTH_TOKEN`, `EBAY_MERCHANT_LOCATION_KEY`,
  `EBAY_FULFILLMENT_POLICY_ID`, `EBAY_PAYMENT_POLICY_ID`,
  `EBAY_RETURN_POLICY_ID` — turns on real eBay publishing. You get the OAuth
  token by registering a developer app at developer.ebay.com and completing
  the user-consent flow for your own seller account; the policy IDs come
  from your eBay seller account's business policies.
- `PORT` — defaults to 3000.

## Data storage

Listings and their per-marketplace status live in `data/db.json` (a plain
JSON file — no database server needed). Uploaded photos are saved to
`uploads/`. Both are gitignored since they're local data, not source.

## Project layout

```
resell-hub/
  server.js                  express app entry point
  db.js                      tiny JSON-file data store
  routes/listings.js         create / generate / publish / sold / delete
  services/ai.js             description + price generation (Claude or fallback)
  services/connectors/       one module per marketplace, common publish/unpublish interface
  public/                    the dashboard UI (vanilla HTML/CSS/JS, no build step)
```

## Extending it

To add a marketplace that does have a real API for you (e.g. you have an
Etsy or Shopify shop), copy `services/connectors/ebay.js` as a starting
point and register it in `services/connectors/index.js`.
