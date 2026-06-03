/**
 * MenuEngine API client — thin wrapper over the Google Sheets web app.
 * Safe to include even when config.js is missing: `isConfigured()` returns
 * false and the pages fall back to the copy-paste flow.
 */
(function (global) {
  const cfg = (global.MENUENGINE_CONFIG || {});

  function isConfigured() {
    return !!(cfg.apiUrl && cfg.writeToken);
  }

  async function get(action, params) {
    const u = new URL(cfg.apiUrl);
    u.searchParams.set('action', action);
    Object.keys(params || {}).forEach(function (k) { u.searchParams.set(k, params[k]); });
    const res = await fetch(u.toString());
    return res.json();
  }

  async function post(action, body) {
    // text/plain avoids a CORS preflight against Apps Script.
    const res = await fetch(cfg.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ action: action, token: cfg.writeToken }, body))
    });
    return res.json();
  }

  global.MenuEngineAPI = {
    isConfigured: isConfigured,
    hasApi: function () { return !!cfg.apiUrl; },
    ping: function () { return get('ping', {}); },
    getHousehold: function (slug) { return get('getHousehold', { slug: slug }); },
    getMenu: function (slug) { return get('getMenu', { slug: slug }); },
    getWeek: function (slug, start) { return get('getWeek', { slug: slug, start: start || '' }); },
    getVotes: function (slug, start) { return get('getVotes', { slug: slug, start: start || '' }); },
    saveHousehold: function (data) { return post('saveHousehold', data); },
    savePicks: function (data) { return post('savePicks', data); },
    saveMenu: function (data) { return post('saveMenu', data); },
    publishWeek: function (data) { return post('publishWeek', data); },
    getSettings: function (slug) { return get('getSettings', { slug: slug }); },
    saveSettings: function (data) { return post('saveSettings', data); },
    // Member vote submission — gated by household slug, no admin token needed.
    submitVotes: function (data) { return post('submitVotes', data); }
  };
})(window);
