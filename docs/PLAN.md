# MenuEngine — Build Plan

A family menu & recipe generator. You tell it who's eating and what your
family loves; it builds menus and full recipes you can share with a link —
no login required.

## Decisions locked in

| Area | Decision |
|------|----------|
| Engine | **Hybrid** — a curated recipe library + **Claude Opus** generation with **online search** for new/seasonal ideas |
| Sharing | **Shareable links, no login.** Access via unguessable slugs |
| Hosting | **Vercel** — static front-end + serverless functions |
| Database | **Supabase Postgres** |
| AI access | Uses the Anthropic API key server-side. Opus is sufficient; online search enabled for fresh ideas |

## Architecture

```
Browser (static HTML/JS on Vercel)
   │  taste picks + household profile (JSON)
   ▼
Vercel serverless functions  ──►  Anthropic API (Claude Opus + web search)
   │  (service-role key)
   ▼
Supabase Postgres  ──►  households, members, recipes, taste_picks, menus, menu_items
```

The browser never touches Postgres directly. Serverless functions hold the
service-role key and the Anthropic key. RLS is on with no anon policies, so
the only path to data is through our functions (see `docs/schema.sql`).

## Build steps

- [x] **Step 1 — Taste setup** (`index.html`)
  Card-based picker across 🇹🇭 Thai · 🇨🇳 Chinese · 🇯🇵 Japanese · 🇺🇸 American.
  Tap to select (event-delegation, works on touch), persists to localStorage,
  "Copy my picks" exports JSON. First real profile captured in
  `docs/taste-profile.json` (50 dishes).
- [x] **Step 2 — Household & members** (`profile.html`)
  Household name + per-member age group, spice tolerance, portion, diet,
  allergies, dislikes. Persists locally, "Copy my household" exports JSON.
- [x] **Step 3 — Schema** (`docs/schema.sql`)
  Households, members, recipes, taste_picks, menus, menu_items, generations.
- [ ] **Step 4 — Supabase project + serverless wiring**
  Create project, apply schema, add `/api/*` functions (create household,
  save picks, generate menu).
- [ ] **Step 5 — Menu generation**
  Serverless endpoint: feed taste profile + household into Claude Opus (with
  web search), match against the curated library, fill gaps by generation,
  return a structured weekly/monthly menu + recipes. Persist to `menus`.
- [ ] **Step 6 — Shareable menu view**
  `menu.html?slug=…` renders the menu + recipes from a share slug; printable
  shopping list.

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
