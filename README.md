# 🍽️ MenuEngine

A family menu & recipe generator. Tell it **who's eating** and **what your
family loves** — it builds menus and full recipes you can share with a link.
**No login required.**

## How it works

1. **Taste setup** — open `index.html`, tap the dishes your family enjoys
   across Thai, Chinese, Japanese, and American home cooking. Hit
   **Copy my picks** to export them.
2. **Household** — open `profile.html`, add each family member with their age
   group, spice tolerance, portion size, diet, and allergies. Hit
   **Copy my household**.
3. **Generate** — MenuEngine feeds your taste profile + household into a
   **hybrid engine** (a curated recipe library + **Claude Opus** with online
   search) and produces a weekly/monthly menu with recipes.
4. **Share** — every menu gets an unguessable shareable link. No accounts.

## Stack

- **Front-end:** static HTML/CSS/JS (no build step) on **Vercel**
- **Database:** a **Google Sheet** exposed as a free JSON API via a Google
  Apps Script web app (see [`backend/gsheet/SETUP.md`](backend/gsheet/SETUP.md))
- **Generation:** the **Claude process** (Claude Opus + web search) builds the
  menus directly — no paid API key wired in, so running cost is **$0**

## Repo layout

```
index.html               Step 1 — taste-setup card picker
profile.html             Step 2 — household & member profiles
api.js                   Client wrapper for the Google Sheets API
config.example.js        Copy to config.js with your web-app URL + token
backend/gsheet/Code.gs   Apps Script web app (the database API)
backend/gsheet/SETUP.md  4-step deploy for the Google Sheets backend
docs/PLAN.md             Full build plan & data contracts
docs/schema.sql          Reference SQL schema (Sheet tabs mirror it)
docs/taste-profile.json  First captured family taste profile (50 dishes)
```

## Try it locally

Just open `index.html` in any browser (works great on a phone). Picks are
saved to `localStorage`, so you can come back and refine them. No server
needed for the setup pages.

## Privacy / access model

No accounts. Households and menus are reached only via **unguessable share
slugs**, so a link is the key. Writes to the sheet require a shared token kept
in your local `config.js` (gitignored). See [`docs/PLAN.md`](docs/PLAN.md).

## Status

**Steps 1–6 done** — end to end working:
1. Taste setup (`index.html`) · 2. Household (`profile.html`) · 3. Schema ·
4. Google Sheets backend (deployed + verified) · 5. First weekly menu generated
and saved · 6. Shareable menu viewer (`menu.html?slug=…`).

The first menu is live in the sheet (slug `z6a3jtpu`). Next up: deploy to
Vercel and add per-recipe pages + shopping lists. See [`docs/PLAN.md`](docs/PLAN.md).
