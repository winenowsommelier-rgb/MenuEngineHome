# MenuEngine — Google Sheets backend setup

The database is a single Google Sheet ("**MenuEngine DB**") exposed as a free
JSON API through a **Google Apps Script web app**. No servers, no monthly cost,
no login for users — menus and households are reached by unguessable share
slugs, and writes are protected by a shared token.

> The spreadsheet has already been created in your Drive:
> **MenuEngine DB** →
> https://docs.google.com/spreadsheets/d/1kMaUMwH_6n3VkvZaYCoxdhEvbIXXOWFUuqK9aRhIV80/edit
> (id: `1kMaUMwH_6n3VkvZaYCoxdhEvbIXXOWFUuqK9aRhIV80`)

## One-time deploy (about 4 steps, ~3 minutes)

1. **Open the script editor**
   In the spreadsheet: **Extensions → Apps Script**. Delete the starter
   `myFunction` and paste the entire contents of [`Code.gs`](Code.gs).

2. **Set your write token**
   At the top of the file, change:
   ```js
   const WRITE_TOKEN = 'CHANGE_ME_to_a_long_random_string';
   ```
   to any long random string. Keep a copy — the app uses the same value.

3. **Build the tabs**
   In the editor toolbar, pick the function **`setup`** and click **Run**.
   Approve the permission prompt (it's your own sheet). This creates the
   `Households, Members, TastePicks, Recipes, Menus, MenuItems` tabs.

4. **Publish as a web app**
   **Deploy → New deployment → type: Web app**.
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**
   Click **Deploy**, authorize, and **copy the Web app URL**
   (looks like `https://script.google.com/macros/s/AKfy…/exec`).

## Wire it into the app

Put the two values into `config.js` at the repo root:

```js
window.MENUENGINE_CONFIG = {
  apiUrl: 'https://script.google.com/macros/s/AKfy…/exec',
  writeToken: 'the-same-long-random-string'
};
```

> Note: the write token lives in client config, so treat it as "good enough to
> stop casual writes," not a hard secret. For a family app that's fine. If you
> ever want true secrecy, move writes behind a Vercel serverless function and
> keep the token there instead.

## Quick test

After deploying, open in a browser:

```
<your web app URL>?action=ping
```

You should see `{"ok":true,"app":"MenuEngine"}`.

## API reference (v2)

Tabs built by `setup()`: Households, Members, TastePicks, Recipes, Menus,
MenuItems, **Meals, MealDishes, Votes, Ingredients**.

**Reads** (GET, gated by share slug):
- `?action=ping` → health check (`{ok:true, v:2}`)
- `?action=getHousehold&slug=…` → household + members + picks
- `?action=getMenu&slug=…` → legacy single menu + items
- `?action=getWeek&slug=…&start=YYYY-MM-DD` → members + the week's meals, each
  with its dishes (the 3-meals-a-day model)
- `?action=getVotes&slug=…&start=YYYY-MM-DD` → all member votes for the week

**Admin writes** (POST JSON, must include the `"token"`):
- `saveHousehold` → `{token, id?, share_slug?, name, members:[{code,name,sex,age,weight_kg,height_cm,diet,spice,portion,portion_factor,lunchWeekday,allergies,dislikes,health,goals,texture,notes}]}`
- `savePicks` → `{token, household_id, byCuisine:{Thai:[…],…}}`
- `saveMenu` → `{token, household_id, title, period, starts_on, items:[…]}` (legacy)
- `publishWeek` → `{token, slug|household_id, week_start, status, meals:[{date,meal_type,position,dishes:[{dish_name,cuisine,role,notes,planned_servings,position}]}]}`

**Member write** (POST JSON, gated by household `slug` — NO admin token):
- `submitVotes` → `{slug, member_code, week_start, vetoes:[{date, meal_type, vote, dish_name, reason}]}`
  (replaces that member's votes for the week). `vote` is either:
  - `"dislike"` + `dish_name` → present but skipping that one dish (signals a swap)
  - `"away"` (no dish_name) → not eating that meal at all (drops their portion)

Array fields (`allergies`, `dislikes`) are stored pipe-`|`-joined in cells.
