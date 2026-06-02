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
- **Back-end:** Vercel serverless functions (`/api`)
- **AI:** Anthropic API — **Claude Opus** + web search (server-side only)
- **Database:** **Supabase Postgres** (see [`docs/schema.sql`](docs/schema.sql))

## Repo layout

```
index.html            Step 1 — taste-setup card picker
profile.html          Step 2 — household & member profiles
docs/PLAN.md          Full build plan & data contracts
docs/schema.sql       Supabase Postgres schema
docs/taste-profile.json  First captured family taste profile (50 dishes)
```

## Try it locally

Just open `index.html` in any browser (works great on a phone). Picks are
saved to `localStorage`, so you can come back and refine them. No server
needed for the setup pages.

## Privacy / access model

The browser never talks to the database directly. All data flows through
serverless functions that hold the secrets; tables use row-level security
with no public policies, and menus are reached only via unguessable share
slugs. See [`docs/PLAN.md`](docs/PLAN.md) for the architecture.

## Status

Steps 1–3 done (setup pages + schema). Next: Supabase project wiring and
the menu-generation endpoint. See [`docs/PLAN.md`](docs/PLAN.md).
