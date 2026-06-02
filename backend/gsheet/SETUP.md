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

## API reference

**Reads** (GET):
- `?action=ping` → health check
- `?action=getHousehold&slug=<share_slug>` → household + members + picks
- `?action=getMenu&slug=<share_slug>` → menu + items (sorted)

**Writes** (POST JSON, must include `"token"`):
- `saveHousehold` → `{token, name, members:[{code,name,sex,age,weight_kg,height_cm,diet,spice,portion,allergies,dislikes,health,goals,texture,notes}]}`
  → returns `{id, share_slug}`. Pass `id` + `share_slug` to update an existing
  household in place (keeps the share link stable).
- `savePicks` → `{token, household_id, byCuisine:{Thai:[...],...}}`
- `saveMenu` → `{token, household_id, title, period, starts_on, items:[{dish_name,cuisine,meal_slot,scheduled_date,servings,notes,recipe_id,position}]}`
  → returns `{id, share_slug}`

Array fields (`allergies`, `dislikes`) are stored pipe-`|`-joined in cells.
