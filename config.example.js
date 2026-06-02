/**
 * MenuEngine front-end config.
 * Copy this file to `config.js` and fill in the values from your
 * Google Apps Script web-app deployment (see backend/gsheet/SETUP.md).
 *
 * `config.js` is gitignored so your token doesn't get committed.
 * If config.js is absent, the setup pages still work fully via the
 * "Copy my picks" / "Copy my household" copy-paste flow.
 */
window.MENUENGINE_CONFIG = {
  apiUrl: '',      // e.g. 'https://script.google.com/macros/s/AKfy.../exec'
  writeToken: ''   // the same long random string set in Code.gs WRITE_TOKEN
};
