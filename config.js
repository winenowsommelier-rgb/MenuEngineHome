/**
 * MenuEngine PUBLIC config (safe to commit & deploy).
 * Holds only the read-only API URL and share slugs — NO write token.
 *
 * The write token is loaded separately from config.local.js (gitignored),
 * which is optional: setup pages work via copy-paste, and menu saves are
 * performed server-side. Browser writes stay disabled unless a token is present.
 */
window.MENUENGINE_CONFIG = Object.assign({
  apiUrl: 'https://script.google.com/macros/s/AKfycbyv7-6FLmWs0mmXU2BP5BThNklh87eNUyvhdbMEJlyd2NKlF0oF79fi7d8ea8nDDUdL/exec',
  writeToken: '',            // overridden by config.local.js if present
  householdSlug: 'pv7unk2v', // seeded "My Family" household + 50 picks
  defaultMenuSlug: 'z6a3jtpu' // first generated weekly menu
}, window.MENUENGINE_CONFIG || {});
