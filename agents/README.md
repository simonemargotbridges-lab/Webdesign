# Simone Outreach Agents

A small Node.js toolkit that automates the outreach side of the web design
business:

1. **Finds** local businesses that don't appear to have a website.
2. **Writes** a personalized cold email for each one (Claude).
3. **Generates** a starter website preview for each prospect (Claude).
4. **Sends** the emails from your Gmail, with a y/N confirmation on every
   single send (so nothing goes out without you seeing it).

Each email signature includes your **Venmo link** so interested clients can
pay a deposit directly.

---

## What you need before running

| Thing | Where to get it | Used for |
|---|---|---|
| Node.js 18+ | <https://nodejs.org> | running the scripts |
| Anthropic API key | <https://console.anthropic.com> | drafting emails + generating sites |
| Google Places API key | <https://console.cloud.google.com/apis/library/places.googleapis.com> | finding businesses |
| Gmail account with 2FA + App Password | <https://myaccount.google.com/apppasswords> | sending emails |
| Venmo username | your Venmo profile | payment link in emails |

> Heads up: Google Places API and the Anthropic API both cost a small amount
> of money per call. At the scale this script runs (a few dozen prospects at
> a time) it's usually pennies, but check the pricing pages.

---

## Setup

```bash
cd agents
npm install
cp .env.example .env
# then open .env and fill in all the keys
```

## The four commands

```bash
# 1. Find businesses near you that don't have a website
npm run find

# 2. Use Claude to draft personalized emails for each
npm run draft

# 3. (optional) Use Claude to generate a starter website preview for each
npm run site -- --all

# 4. Review drafts and send them via Gmail (asks before each send)
npm run send
```

Or run the whole pipeline at once:

```bash
npm run run              # find → draft → review/send
npm run run -- --sites   # also generate preview sites
npm run run -- --no-send # dry run, no sending
```

### Safety defaults

- `DRY_RUN=true` in `.env` means **nothing is sent** — emails are only
  printed to the terminal. Set it to `false` when you're ready.
- `MAX_EMAILS_PER_RUN=5` caps how many can go out per run. Keep this low.
- Every send asks `Send this email? [y/N]` in the terminal.
- Every successful send is logged to `data/sent-log.json` so the same
  prospect is never emailed twice.

---

## About the Venmo piece

Venmo does not have a public API for sending or requesting money from code.
What this toolkit does instead — which is what almost every real small
business does — is include your Venmo profile link (`VENMO_LINK` in `.env`)
at the bottom of every outreach email. When a client says "yes, let's do
it," they click the link and pay you directly.

If you ever want to do in-app charges programmatically, you'd have to switch
to a developer-friendly processor like **Stripe** or **Square** — both have
free accounts, real APIs, and give you a hosted checkout URL you can paste
into an email the same way.

---

## About finding email addresses

The Google Places API returns a phone number, address, and website — but
rarely an email. There are three practical options:

1. **Contact form route (default):** if no email is found, the sender
   falls back to sending the draft to *yourself*. You then paste it into
   the business's Google listing contact form or text it to the phone
   number. This keeps everything above-board.
2. **Manual enrich:** open `data/prospects.json` after `npm run find` and
   add an `"email"` field to any rows where you've found one (from the
   business's Instagram bio, Yelp page, etc.).
3. **Paid enrichment APIs** (Hunter.io, Apollo, Clearbit) — not wired in
   here, but `findProspects.js` is the right place to add a call if you
   want to.

---

## Cold email legal basics (CAN-SPAM)

Since you're sending commercial email to US businesses, the law requires:

- A truthful subject line (Claude is prompted to do this).
- Your physical mailing address in the footer — set `YOUR_MAILING_ADDRESS`
  in `.env`. Add it manually to the signature in `writeEmail.js` if you
  want it in every email.
- A way to opt out. The simplest version: add a line like
  *"Reply STOP and I won't contact you again"* to the signature, and
  actually honor it (track opt-outs in `data/sent-log.json`).

Keep volume low (a few dozen per week, not thousands) and every email
personalized — that's what separates real outreach from spam.

---

## Files

```
agents/
├── package.json
├── .env.example           # copy to .env and fill in
├── .gitignore             # keeps .env and generated data out of git
├── README.md              # this file
├── src/
│   ├── config.js          # loads env vars
│   ├── findProspects.js   # Google Places → data/prospects.json
│   ├── writeEmail.js      # Claude → data/drafts.json
│   ├── sendEmail.js       # Gmail sender with y/N gate
│   ├── generateSite.js    # Claude → generated-sites/<slug>/index.html
│   └── run.js             # orchestrator (find → draft → send)
├── data/                  # gitignored — prospects, drafts, sent log
└── generated-sites/       # gitignored — Claude-generated site previews
```
