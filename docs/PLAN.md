# MenuEngine — Build Plan

A family menu & recipe generator. You tell it who's eating and what your
family loves; it builds menus and full recipes you can share with a link —
no login required.

## Decisions locked in

| Area | Decision |
|------|----------|
| Engine | **Hybrid** — a curated recipe library + **Claude Opus** generation with **online search** for new/seasonal ideas |
| Sharing | **Shareable links, no login.** Access via unguessable slugs |
| Hosting | **Vercel** — static front-end (no build step) |
| Database | **Google Sheet** ("MenuEngine DB") exposed as a free JSON API via a Google Apps Script web app — $0, no project limits |
| Generation | **The Claude process** (this session) generates menus with **web search**. No paid Anthropic API key is wired in — keeps running cost at $0 |

> Earlier plan used Supabase Postgres + a server-side Anthropic API key. We
> switched to Google Sheets to stay free (Supabase free tier caps active
> projects) and to let the Claude process do generation directly. The original
> SQL schema is kept in `docs/schema.sql` as a reference / future migration
> target — the Sheet tabs mirror it.

## Architecture

```
Browser (static HTML/JS on Vercel)
   │  reads: getHousehold/getMenu by share slug
   │  writes: saveHousehold/savePicks/saveMenu (+ write token)
   ▼
Google Apps Script web app  ──►  Google Sheet "MenuEngine DB"
   (free JSON API)                tabs: Households, Members, TastePicks,
                                  Recipes, Menus, MenuItems

Menu generation: the Claude process (this session) reads the taste profile +
household, uses web search for fresh/seasonal ideas, and writes the resulting
menu back via saveMenu.
```

Reads are gated by unguessable share slugs; writes by a shared token. See
`backend/gsheet/SETUP.md` for the deploy and `backend/gsheet/Code.gs` for the API.

## Build steps

- [x] **Step 1 — Taste setup** (`index.html`)
  Card-based picker across 🇹🇭 Thai · 🇨🇳 Chinese · 🇯🇵 Japanese · 🇺🇸 American.
  Tap to select (event-delegation, works on touch), persists to localStorage,
  "Copy my picks" exports JSON. First real profile captured in
  `docs/taste-profile.json` (50 dishes).
- [x] **Step 2 — Household & members** (`profile.html`)
  Household name + per-member age group, spice tolerance, portion, diet,
  allergies, dislikes. Persists locally, "Copy my household" exports JSON.
- [x] **Step 3 — Schema** (`docs/schema.sql` + Google Sheet tabs)
  Households, members, recipes, taste_picks, menus, menu_items. The live store
  is the Google Sheet; the SQL file is kept as a reference.
- [x] **Step 4 — Google Sheets backend** ✅ deployed & verified
  Spreadsheet "MenuEngine DB" created in Drive. Apps Script web app
  (`backend/gsheet/Code.gs`) deployed and live; read + write round-trips
  confirmed. Client glue in `api.js` + `config.example.js`; live URL + token in
  local `config.js` (gitignored). Seeded household "My Family" with all 50
  taste picks. Deploy steps in `backend/gsheet/SETUP.md`.
- [x] **Step 5 — Menu generation** ✅ first menu live
  The Claude process built a balanced 7-day dinner plan from the 50 picks
  (family of 4, medium spice) and saved it via `saveMenu`. Menu slug `z6a3jtpu`,
  17 items across Thai/Chinese/Japanese/American. Future runs can add web
  search for fresh/seasonal ideas and a curated-library match step.
- [x] **Step 6 — Shareable menu view** ✅
  `menu.html?slug=…` fetches via `getMenu` and renders the week as day cards
  (cuisine pills, role tags, notes), with a print button. Public config split:
  `config.js` (committed, read-only apiUrl + slugs) vs `config.local.js`
  (gitignored, write token).

## Next ideas

- [ ] Deploy to Vercel (static — just point it at the repo; no build step).
- [ ] Wire `index.html` / `profile.html` "Save" buttons to the API directly
  (currently copy-paste; needs the write token, so route via a tiny serverless
  proxy or a prompt).
- [ ] Per-recipe pages with ingredients + steps + a generated shopping list.
- [ ] Seed the `Recipes` tab from the curated library and link `recipe_id`s.

## Data contracts

**Taste picks** (from `index.html`) → see `docs/taste-profile.json`.

**Household** (from `profile.html`):
```json
{
  "app": "MenuEngine",
  "step": "household",
  "householdName": "The Tan Family",
  "pax": 4,
  "members": [
    { "name": "Mom", "ageGroup": "Adult", "spice": "Medium",
      "portion": "Regular", "diet": "Omnivore",
      "allergies": ["Shellfish"], "dislikes": ["cilantro"] }
  ]
}
```

## Conventions

- Static front-end is plain HTML/CSS/JS (no build step) so it deploys to
  Vercel as-is and runs from a file too.
- Server code lives under `/api` (Vercel serverless).
- Secrets (Anthropic key, Supabase service-role key) only ever live in Vercel
  environment variables — never in the repo or client.
