/**
 * MenuEngine — Google Sheets backend (Apps Script Web App) · v2
 * ----------------------------------------------------------------------------
 * Free, login-free JSON API over the "MenuEngine DB" spreadsheet.
 *
 * v2 adds the 3-meals-a-day monthly model:
 *   Meals, MealDishes, Votes, Ingredients tabs; richer Members.
 *
 * Auth:
 *   - READS need an unguessable share `slug` (link = the key).
 *   - ADMIN WRITES (saveHousehold, savePicks, saveMenu, publishWeek) need the
 *     shared WRITE_TOKEN below.
 *   - MEMBER WRITES (submitVotes) are gated by the household `slug` only, so
 *     family members can vote without the admin token.
 *
 * Deploy / redeploy: see backend/gsheet/SETUP.md. When updating, paste this
 * file, run setup(), then Deploy → Manage deployments → Edit → New version
 * (keeps the same /exec URL).
 * ----------------------------------------------------------------------------
 */

// 🔐 Change to a long random string; use the same value where the app writes.
const WRITE_TOKEN = 'CHANGE_ME_to_a_long_random_string';

const SHEETS = {
  Households: ['id', 'name', 'share_slug', 'locale', 'created_at'],
  Members:    ['id', 'household_id', 'code', 'name', 'sex', 'age',
               'weight_kg', 'height_cm', 'diet', 'spice_level', 'portion',
               'portion_factor', 'lunch_weekday', 'allergies', 'dislikes',
               'health', 'goals', 'texture', 'notes', 'created_at'],
  TastePicks: ['id', 'household_id', 'member_id', 'dish_name', 'cuisine',
               'sentiment', 'created_at'],
  Recipes:    ['id', 'name', 'cuisine', 'course', 'proteins', 'tags',
               'spice_level', 'prep_min', 'cook_min', 'servings',
               'ingredients', 'steps', 'image_url', 'source', 'created_at'],
  Menus:      ['id', 'household_id', 'share_slug', 'title', 'period',
               'starts_on', 'status', 'created_at'],
  MenuItems:  ['id', 'menu_id', 'recipe_id', 'dish_name', 'cuisine',
               'scheduled_date', 'meal_slot', 'servings', 'notes',
               'position', 'created_at'],
  // ---- v2: 3-meal monthly model ----
  Meals:      ['id', 'household_id', 'week_start', 'date', 'meal_type',
               'status', 'position', 'created_at'],
  MealDishes: ['id', 'meal_id', 'dish_name', 'cuisine', 'role', 'recipe_id',
               'planned_servings', 'notes', 'position', 'created_at'],
  Votes:      ['id', 'household_id', 'week_start', 'date', 'meal_type',
               'member_code', 'vote', 'reason', 'created_at'],
  Ingredients:['id', 'recipe_id', 'item', 'qty_per_serving', 'unit', 'aisle',
               'created_at'],
};

/** Run once (and after schema changes) to build/refresh all tab headers. */
function setup() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(SHEETS).forEach(function (name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const headers = SHEETS[name];
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  });
  const def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
  return 'setup complete';
}

// ===== HTTP handlers ========================================================

function doGet(e) {
  try {
    const action = (e.parameter.action || 'ping');
    if (action === 'ping') return json({ ok: true, app: 'MenuEngine', v: 2 });

    if (action === 'getHousehold') {
      const hh = findBy('Households', 'share_slug', e.parameter.slug);
      if (!hh) return json({ ok: false, error: 'not_found' });
      return json({ ok: true, household: hh,
        members: filterBy('Members', 'household_id', hh.id),
        picks: filterBy('TastePicks', 'household_id', hh.id) });
    }

    if (action === 'getMenu') {
      const menu = findBy('Menus', 'share_slug', e.parameter.slug);
      if (!menu) return json({ ok: false, error: 'not_found' });
      const items = filterBy('MenuItems', 'menu_id', menu.id)
        .sort(function (a, b) { return (a.position || 0) - (b.position || 0); });
      return json({ ok: true, menu: menu, items: items });
    }

    if (action === 'getWeek') {
      const hh = findBy('Households', 'share_slug', e.parameter.slug);
      if (!hh) return json({ ok: false, error: 'not_found' });
      const start = e.parameter.start;
      const meals = filterBy('Meals', 'household_id', hh.id)
        .filter(function (m) { return !start || String(m.week_start) === String(start); })
        .sort(function (a, b) {
          if (a.date === b.date) return (a.position || 0) - (b.position || 0);
          return String(a.date) < String(b.date) ? -1 : 1;
        })
        .map(function (m) {
          m.dishes = filterBy('MealDishes', 'meal_id', m.id)
            .sort(function (a, b) { return (a.position || 0) - (b.position || 0); });
          return m;
        });
      return json({ ok: true, household: { name: hh.name, slug: hh.share_slug },
        week_start: start || '', members: filterBy('Members', 'household_id', hh.id),
        meals: meals });
    }

    if (action === 'getVotes') {
      const hh = findBy('Households', 'share_slug', e.parameter.slug);
      if (!hh) return json({ ok: false, error: 'not_found' });
      const start = e.parameter.start;
      const votes = filterBy('Votes', 'household_id', hh.id)
        .filter(function (v) { return !start || String(v.week_start) === String(start); });
      return json({ ok: true, votes: votes });
    }

    return json({ ok: false, error: 'unknown_action' });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const action = body.action;

    // ----- Member write: votes (gated by household slug, no admin token) -----
    if (action === 'submitVotes') {
      const hh = findBy('Households', 'share_slug', body.slug);
      if (!hh) return json({ ok: false, error: 'not_found' });
      const code = body.member_code;
      const start = body.week_start || '';
      if (!code) return json({ ok: false, error: 'member_code_required' });
      // Replace this member's votes for the week.
      deleteMatch('Votes', { household_id: hh.id, week_start: start, member_code: code });
      (body.vetoes || []).forEach(function (v) {
        upsert('Votes', {
          id: uid(), household_id: hh.id, week_start: start,
          date: v.date || '', meal_type: v.meal_type || '',
          member_code: code, vote: 'dislike', reason: v.reason || '',
          created_at: now(),
        });
      });
      return json({ ok: true, count: (body.vetoes || []).length });
    }

    // ----- Everything below requires the admin write token -----
    if (body.token !== WRITE_TOKEN) return json({ ok: false, error: 'unauthorized' });

    if (action === 'saveHousehold') {
      const id = body.id || uid();
      const slug = body.share_slug || slug6();
      upsert('Households', { id: id, name: body.name || '', share_slug: slug,
        locale: body.locale || 'en-US', created_at: now() });
      deleteMatch('Members', { household_id: id });
      (body.members || []).forEach(function (m) {
        upsert('Members', {
          id: uid(), household_id: id,
          code: m.code || '', name: m.name || 'Unnamed', sex: m.sex || '',
          age: m.age != null ? m.age : '',
          weight_kg: m.weight_kg != null ? m.weight_kg : '',
          height_cm: m.height_cm != null ? m.height_cm : '',
          diet: m.diet || 'Omnivore',
          spice_level: m.spice != null ? m.spice : 1,
          portion: m.portion || 'Regular',
          portion_factor: m.portion_factor != null ? m.portion_factor : 1.0,
          lunch_weekday: m.lunchWeekday || m.lunch_weekday || 'home',
          allergies: (m.allergies || []).join('|'),
          dislikes: (m.dislikes || []).join('|'),
          health: m.health || '', goals: m.goals || '',
          texture: m.texture || '', notes: m.notes || '',
          created_at: now(),
        });
      });
      return json({ ok: true, id: id, share_slug: slug });
    }

    if (action === 'savePicks') {
      const hid = body.household_id;
      if (!hid) return json({ ok: false, error: 'household_id_required' });
      deleteMatch('TastePicks', { household_id: hid });
      const byCuisine = body.byCuisine || {};
      Object.keys(byCuisine).forEach(function (cuisine) {
        byCuisine[cuisine].forEach(function (dish) {
          upsert('TastePicks', { id: uid(), household_id: hid, member_id: '',
            dish_name: dish, cuisine: cuisine, sentiment: 'love', created_at: now() });
        });
      });
      return json({ ok: true });
    }

    if (action === 'saveMenu') {
      const id = body.id || uid();
      const slug = body.share_slug || slug6();
      upsert('Menus', { id: id, household_id: body.household_id || '', share_slug: slug,
        title: body.title || '', period: body.period || 'week',
        starts_on: body.starts_on || '', status: body.status || 'published', created_at: now() });
      deleteMatch('MenuItems', { menu_id: id });
      (body.items || []).forEach(function (it, i) {
        upsert('MenuItems', { id: uid(), menu_id: id, recipe_id: it.recipe_id || '',
          dish_name: it.dish_name || '', cuisine: it.cuisine || '',
          scheduled_date: it.scheduled_date || '', meal_slot: it.meal_slot || 'dinner',
          servings: it.servings || 4, notes: it.notes || '',
          position: it.position != null ? it.position : i, created_at: now() });
      });
      return json({ ok: true, id: id, share_slug: slug });
    }

    // ----- v2: publish a week of 3-meal days -----
    if (action === 'publishWeek') {
      let hid = body.household_id;
      if (!hid && body.slug) {
        const hh = findBy('Households', 'share_slug', body.slug);
        hid = hh ? hh.id : null;
      }
      if (!hid) return json({ ok: false, error: 'household_required' });
      const start = body.week_start || '';
      const status = body.status || 'published';
      // Clear existing meals (and their dishes) for this household + week.
      const old = filterBy('Meals', 'household_id', hid)
        .filter(function (m) { return String(m.week_start) === String(start); });
      old.forEach(function (m) { deleteMatch('MealDishes', { meal_id: m.id }); });
      deleteMatch('Meals', { household_id: hid, week_start: start });

      (body.meals || []).forEach(function (meal, mi) {
        const mealId = uid();
        upsert('Meals', {
          id: mealId, household_id: hid, week_start: start,
          date: meal.date || '', meal_type: meal.meal_type || 'dinner',
          status: status, position: meal.position != null ? meal.position : mi,
          created_at: now(),
        });
        (meal.dishes || []).forEach(function (d, di) {
          upsert('MealDishes', {
            id: uid(), meal_id: mealId, dish_name: d.dish_name || d.n || '',
            cuisine: d.cuisine || d.c || '', role: d.role || d.r || '',
            recipe_id: d.recipe_id || '',
            planned_servings: d.planned_servings != null ? d.planned_servings : '',
            notes: d.notes || d.note || '',
            position: d.position != null ? d.position : di, created_at: now(),
          });
        });
      });
      return json({ ok: true, household_id: hid, week_start: start,
        meals: (body.meals || []).length });
    }

    return json({ ok: false, error: 'unknown_action' });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

// ===== Sheet helpers ========================================================

function sheet(name) { return SpreadsheetApp.getActive().getSheetByName(name); }

function rows(name) {
  const values = sheet(name).getDataRange().getValues();
  const headers = values.shift();
  return values.filter(function (r) { return String(r[0]).length; })
    .map(function (r) { const o = {}; headers.forEach(function (h, i) { o[h] = r[i]; }); return o; });
}

function findBy(name, col, val) {
  if (val == null || val === '') return null;
  const all = rows(name);
  for (let i = 0; i < all.length; i++) if (String(all[i][col]) === String(val)) return all[i];
  return null;
}

function filterBy(name, col, val) {
  return rows(name).filter(function (r) { return String(r[col]) === String(val); });
}

function upsert(name, obj) {
  const sh = sheet(name), headers = SHEETS[name];
  const row = headers.map(function (h) { return obj[h] != null ? obj[h] : ''; });
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(obj.id)) {
      sh.getRange(i + 1, 1, 1, headers.length).setValues([row]); return;
    }
  }
  sh.appendRow(row);
}

// Delete all rows where every key in matchObj equals the row's value.
function deleteMatch(name, matchObj) {
  const sh = sheet(name), headers = SHEETS[name];
  const cols = Object.keys(matchObj).map(function (k) {
    return { idx: headers.indexOf(k), val: String(matchObj[k]) };
  });
  const data = sh.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    const hit = cols.every(function (c) { return String(data[i][c.idx]) === c.val; });
    if (hit) sh.deleteRow(i + 1);
  }
}

// ===== Utils ================================================================

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function now() { return new Date().toISOString(); }
function uid() { return Utilities.getUuid(); }
function slug6() {
  const c = 'abcdefghijkmnpqrstuvwxyz23456789'; let s = '';
  for (let i = 0; i < 8; i++) s += c.charAt(Math.floor(Math.random() * c.length));
  return s;
}
