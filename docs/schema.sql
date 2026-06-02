-- MenuEngine — Postgres schema (REFERENCE ONLY)
-- ---------------------------------------------------------------------------
-- NOTE: The live datastore is a Google Sheet ("MenuEngine DB") exposed via a
-- Google Apps Script web app (see backend/gsheet/). This SQL file is kept as a
-- reference and a future migration target — the Sheet tabs mirror these tables
-- (Households, Members, TastePicks, Recipes, Menus, MenuItems).
-- ---------------------------------------------------------------------------
-- Access model: NO LOGIN. Everything is reached through unguessable share
-- slugs. The browser never talks to Postgres directly — all reads/writes go
-- through Vercel serverless functions using the Supabase SERVICE ROLE key.
-- Therefore RLS is enabled with NO anon policies (deny-all to the public
-- anon key); the service role bypasses RLS. This keeps data private while
-- supporting login-free shareable links.
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ===== Households ==========================================================
create table if not exists households (
  id           uuid primary key default gen_random_uuid(),
  name         text not null default '',
  share_slug   text unique not null,             -- unguessable, used in URLs
  locale       text not null default 'en-US',
  created_at   timestamptz not null default now()
);

-- ===== Members =============================================================
create table if not exists members (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  code         text,                               -- short per-person login code (e.g. GGM, D, N1)
  name         text not null default 'Unnamed',
  sex          text,                               -- M|F|other
  age          int,
  weight_kg    numeric,
  height_cm    numeric,
  diet         text not null default 'Omnivore'    -- Omnivore|Vegetarian|Vegan|Pescatarian|Halal|Kosher
                 check (diet in ('Omnivore','Vegetarian','Vegan','Pescatarian','Halal','Kosher')),
  spice_level  smallint not null default 1         -- 0 none .. 3 hot
                 check (spice_level between 0 and 3),
  portion      text not null default 'Regular'     -- Small|Regular|Large
                 check (portion in ('Small','Regular','Large')),
  allergies    text[] not null default '{}',
  dislikes     text[] not null default '{}',       -- e.g. beef, fish, raw fish
  health       text,                               -- conditions: diabetes, Alzheimer's, etc.
  goals        text,                               -- high protein, more fiber, weight mgmt, soft food
  texture      text,                               -- soft / easy to chew / regular
  notes        text,
  created_at   timestamptz not null default now()
);
create index if not exists members_household_idx on members(household_id);

-- ===== Recipe library (curated + generated) ================================
create table if not exists recipes (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  cuisine       text not null,                     -- Thai|Chinese|Japanese|American|...
  course        text not null default 'main'       -- main|soup|side|dessert|snack|breakfast
                  check (course in ('main','soup','side','dessert','snack','breakfast')),
  proteins      text[] not null default '{}',      -- chicken|pork|beef|seafood|tofu|egg|veg
  tags          text[] not null default '{}',      -- e.g. rice, noodle, stir-fry, grill
  spice_level   smallint not null default 0 check (spice_level between 0 and 3),
  prep_min      int,
  cook_min      int,
  servings      int default 4,
  ingredients   jsonb not null default '[]',       -- [{item, qty, unit}]
  steps         jsonb not null default '[]',       -- ["step 1", ...]
  image_url     text,
  source        text not null default 'curated'    -- curated|generated
                  check (source in ('curated','generated')),
  source_meta   jsonb not null default '{}',       -- model, search refs, etc.
  created_at    timestamptz not null default now()
);
create index if not exists recipes_cuisine_idx on recipes(cuisine);
create unique index if not exists recipes_name_cuisine_uq on recipes(lower(name), cuisine);

-- ===== Taste picks (output of the index.html picker) =======================
create table if not exists taste_picks (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  member_id    uuid references members(id) on delete set null,  -- null = whole household
  dish_name    text not null,
  cuisine      text not null,
  recipe_id    uuid references recipes(id) on delete set null,  -- linked once matched
  sentiment    text not null default 'love'       -- love|like|neutral|dislike
                 check (sentiment in ('love','like','neutral','dislike')),
  created_at   timestamptz not null default now()
);
create index if not exists taste_picks_household_idx on taste_picks(household_id);

-- ===== Menus ===============================================================
create table if not exists menus (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  share_slug   text unique not null,              -- shareable menu link
  title        text not null default '',
  period       text not null default 'week'        -- week|month
                 check (period in ('week','month')),
  starts_on    date,
  status       text not null default 'draft'       -- draft|published
                 check (status in ('draft','published')),
  created_at   timestamptz not null default now()
);
create index if not exists menus_household_idx on menus(household_id);

-- ===== Menu items ==========================================================
create table if not exists menu_items (
  id             uuid primary key default gen_random_uuid(),
  menu_id        uuid not null references menus(id) on delete cascade,
  recipe_id      uuid references recipes(id) on delete set null,
  dish_name      text not null,                   -- denormalized for resilience
  cuisine        text,
  scheduled_date date,
  meal_slot      text not null default 'dinner'    -- breakfast|lunch|dinner|snack
                   check (meal_slot in ('breakfast','lunch','dinner','snack')),
  servings       int default 4,
  notes          text,
  position       int not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists menu_items_menu_idx on menu_items(menu_id);

-- ===== Generation log (Claude runs) ========================================
create table if not exists generations (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  menu_id      uuid references menus(id) on delete set null,
  model        text not null default 'claude-opus-4-8',
  used_search  boolean not null default false,
  prompt       text,
  output       jsonb,
  created_at   timestamptz not null default now()
);

-- ===== RLS: lock the public anon key out entirely ==========================
alter table households  enable row level security;
alter table members     enable row level security;
alter table recipes     enable row level security;
alter table taste_picks enable row level security;
alter table menus       enable row level security;
alter table menu_items  enable row level security;
alter table generations enable row level security;
-- No anon/auth policies are defined → anon key sees nothing.
-- Serverless functions use the service role key, which bypasses RLS.
