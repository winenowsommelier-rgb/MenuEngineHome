/**
 * MenuEngine — Google Sheets backend (Apps Script Web App)
 * ----------------------------------------------------------------------------
 * Turns the "MenuEngine DB" spreadsheet into a free, login-free JSON API.
 *
 * Tabs (created by setup()): Households, Members, TastePicks, Recipes,
 * Menus, MenuItems.
 *
 * Access model (matches the no-login design):
 *   - READS are public but require an unguessable share `slug` (so only people
 *     with the link can fetch a household or menu).
 *   - WRITES require the shared WRITE_TOKEN below, so random visitors can't
 *     scribble into your sheet.
 *
 * Deploy: see backend/gsheet/SETUP.md.
 * ----------------------------------------------------------------------------
 */

// 🔐 Change this to any long random string, then use the same value in the app.
const WRITE_TOKEN = 'CHANGE_ME_to_a_long_random_string';

const SHEETS = {
  Households: ['id', 'name', 'share_slug', 'locale', 'created_at'],
  Members:    ['id', 'household_id', 'code', 'name', 'sex', 'age',
               'weight_kg', 'height_cm', 'diet', 'spice_level', 'portion',
               'allergies', 'dislikes', 'health', 'goals', 'texture',
               'notes', 'created_at'],
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
};

/** Run once from the editor to build all tabs + headers. */
function setup() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(SHEETS).forEach(function (name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const headers = SHEETS[name];
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  });
  // Remove the default empty "Sheet1" if present and unused.
  const def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
  return 'setup complete';
}

// ===== HTTP handlers ========================================================

function doGet(e) {
  try {
    const action = (e.parameter.action || 'ping');
    if (action === 'ping') return json({ ok: true, app: 'MenuEngine' });

    if (action === 'getHousehold') {
      const hh = findBy('Households', 'share_slug', e.parameter.slug);
      if (!hh) return json({ ok: false, error: 'not_found' }, 404);
      const members = filterBy('Members', 'household_id', hh.id);
      const picks = filterBy('TastePicks', 'household_id', hh.id);
      return json({ ok: true, household: hh, members: members, picks: picks });
    }

    if (action === 'getMenu') {
      const menu = findBy('Menus', 'share_slug', e.parameter.slug);
      if (!menu) return json({ ok: false, error: 'not_found' }, 404);
      const items = filterBy('MenuItems', 'menu_id', menu.id)
        .sort(function (a, b) { return (a.position || 0) - (b.position || 0); });
      return json({ ok: true, menu: menu, items: items });
    }

    return json({ ok: false, error: 'unknown_action' }, 400);
  } catch (err) {
    return json({ ok: false, error: String(err) }, 500);
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    if (body.token !== WRITE_TOKEN) return json({ ok: false, error: 'unauthorized' }, 401);

    const action = body.action;

    if (action === 'saveHousehold') {
      const id = body.id || uid();
      const slug = body.share_slug || slug6();
      upsert('Households', {
        id: id, name: body.name || '', share_slug: slug,
        locale: body.locale || 'en-US', created_at: now(),
      });
      // Replace members for this household.
      deleteWhere('Members', 'household_id', id);
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
      const householdId = body.household_id;
      if (!householdId) return json({ ok: false, error: 'household_id_required' }, 400);
      deleteWhere('TastePicks', 'household_id', householdId);
      const byCuisine = body.byCuisine || {};
      Object.keys(byCuisine).forEach(function (cuisine) {
        byCuisine[cuisine].forEach(function (dish) {
          upsert('TastePicks', {
            id: uid(), household_id: householdId, member_id: '',
            dish_name: dish, cuisine: cuisine, sentiment: 'love', created_at: now(),
          });
        });
      });
      return json({ ok: true });
    }

    if (action === 'saveMenu') {
      const id = body.id || uid();
      const slug = body.share_slug || slug6();
      upsert('Menus', {
        id: id, household_id: body.household_id || '', share_slug: slug,
        title: body.title || '', period: body.period || 'week',
        starts_on: body.starts_on || '', status: body.status || 'published',
        created_at: now(),
      });
      deleteWhere('MenuItems', 'menu_id', id);
      (body.items || []).forEach(function (it, i) {
        upsert('MenuItems', {
          id: uid(), menu_id: id, recipe_id: it.recipe_id || '',
          dish_name: it.dish_name || '', cuisine: it.cuisine || '',
          scheduled_date: it.scheduled_date || '', meal_slot: it.meal_slot || 'dinner',
          servings: it.servings || 4, notes: it.notes || '',
          position: it.position != null ? it.position : i, created_at: now(),
        });
      });
      return json({ ok: true, id: id, share_slug: slug });
    }

    return json({ ok: false, error: 'unknown_action' }, 400);
  } catch (err) {
    return json({ ok: false, error: String(err) }, 500);
  }
}

// ===== Sheet helpers ========================================================

function sheet(name) { return SpreadsheetApp.getActive().getSheetByName(name); }

function rows(name) {
  const sh = sheet(name);
  const values = sh.getDataRange().getValues();
  const headers = values.shift();
  return values.filter(function (r) { return String(r[0]).length; })
    .map(function (r) {
      const o = {};
      headers.forEach(function (h, i) { o[h] = r[i]; });
      return o;
    });
}

function findBy(name, col, val) {
  if (!val) return null;
  const all = rows(name);
  for (let i = 0; i < all.length; i++) if (String(all[i][col]) === String(val)) return all[i];
  return null;
}

function filterBy(name, col, val) {
  return rows(name).filter(function (r) { return String(r[col]) === String(val); });
}

function upsert(name, obj) {
  const sh = sheet(name);
  const headers = SHEETS[name];
  const row = headers.map(function (h) { return obj[h] != null ? obj[h] : ''; });
  // Update in place if id exists, else append.
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(obj.id)) {
      sh.getRange(i + 1, 1, 1, headers.length).setValues([row]);
      return;
    }
  }
  sh.appendRow(row);
}

function deleteWhere(name, col, val) {
  const sh = sheet(name);
  const headers = SHEETS[name];
  const idx = headers.indexOf(col);
  const data = sh.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][idx]) === String(val)) sh.deleteRow(i + 1);
  }
}

// ===== Utils ================================================================

function json(obj, code) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function now() { return new Date().toISOString(); }
function uid() { return Utilities.getUuid(); }
function slug6() {
  const c = 'abcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += c.charAt(Math.floor(Math.random() * c.length));
  return s;
}
