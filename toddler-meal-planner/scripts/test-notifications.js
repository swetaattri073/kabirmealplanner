/**
 * Sandbox unit tests for LittleBowlNotifications (no browser).
 * Run: node scripts/test-notifications.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const store = new Map();
const localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const sandbox = {
  window: {},
  localStorage,
  sessionStorage: localStorage,
  console,
  Date,
  Math,
  JSON,
  String,
  Number,
  Array,
  Object,
  setTimeout,
  clearTimeout,
  document: {
    addEventListener() {},
    getElementById() { return null; },
  },
  Notification: undefined,
};
sandbox.window = sandbox;
sandbox.global = sandbox;

const src = fs.readFileSync(
  path.join(__dirname, '..', 'static', 'js', 'notifications.js'),
  'utf8'
);
vm.runInNewContext(src, sandbox);

const N = sandbox.LittleBowlNotifications;
let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed += 1;
    console.log('  ✓', msg);
  } else {
    failed += 1;
    console.error('  ✗', msg);
  }
}

console.log('LittleBowl notification sandbox tests\n');

assert(N.defaultPrefs().enabled === true, 'defaults: enabled=true');
assert(N.defaultPrefs().mealReminders === true, 'defaults: mealReminders=true');
assert(N.defaultPrefs().nutritionAlerts === true, 'defaults: nutritionAlerts=true');

store.clear();
const prefs = N.loadPrefs();
assert(prefs.enabled === true, 'loadPrefs persists enabled by default');
assert(!!localStorage.getItem('littlebowl_notify_prefs_v2'), 'prefs written to storage on first load');

assert(N.parseTime('8:00').hour === 8 && N.parseTime('8:00').minute === 0, 'parseTime 8:00');
assert(N.parseTime('19:30').hour === 19 && N.parseTime('19:30').minute === 30, 'parseTime 19:30');
assert(N.parseTime('bad') === null, 'parseTime rejects junk');

assert(N.mealId('breakfast') === 1100, 'mealId breakfast');
assert(N.mealId('dinner') === 1104, 'mealId dinner');

const fp = N.alertFingerprint({
  type: 'deficiency',
  nutrient: 'iron_mg',
  severity: 'warning',
  message: 'Iron intake is low',
});
assert(fp.includes('iron_mg') && fp.includes('warning'), 'alertFingerprint includes nutrient+severity');

assert(N.MEAL_ORDER.length === 5, 'five meal slots');
assert(N.DEFAULT_TIMES.breakfast === '08:00', 'default breakfast time');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
