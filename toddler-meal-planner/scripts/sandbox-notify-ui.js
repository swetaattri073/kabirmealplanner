/**
 * Puppeteer sandbox: notification UI against a running Flask server.
 * Usage: BASE_URL=http://127.0.0.1:5000 node scripts/sandbox-notify-ui.js
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5000';
const CHROME = process.env.CHROME_PATH || '/usr/local/bin/google-chrome';
const OUT_DIR = process.env.ARTIFACT_DIR || '/opt/cursor/artifacts';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=420,900'],
    defaultViewport: { width: 420, height: 900, deviceScaleFactor: 2 },
  });

  const page = await browser.newPage();
  const results = [];
  const ok = (name, pass, detail) => {
    results.push({ name, pass: !!pass, detail: detail || null });
    console.log(pass ? '✓' : '✗', name, detail || '');
  };

  try {
    const land = await page.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 30000 });
    ok('landing loads', land && land.ok(), `status ${land && land.status()}`);

    const jsRes = await page.goto(BASE + '/static/js/notifications.js', { waitUntil: 'networkidle2' });
    const jsText = await page.evaluate(() => document.body.innerText);
    ok('notifications.js served', jsRes && jsRes.ok() && jsText.includes('enabled: true'));
    ok('prefs key v2 (defaults on)', jsText.includes('littlebowl_notify_prefs_v2'));

    const cssRes = await page.goto(BASE + '/static/css/style.css', { waitUntil: 'networkidle2' });
    const cssText = await page.evaluate(() => document.body.innerText);
    ok('notify CSS present', cssRes && cssRes.ok() && cssText.includes('.notify-toggle-card'));

    // Register via landing #register (confirm_password required)
    await page.goto(BASE + '/#register', { waitUntil: 'networkidle2' });
    await sleep(500);
    const email = `notify_test_${Date.now()}@example.com`;
    await page.waitForSelector('#landing-email', { timeout: 10000 });
    await page.click('#landing-name', { clickCount: 3 }).catch(() => {});
    await page.type('#landing-name', 'Notify Tester');
    await page.type('#landing-email', email);
    await page.type('#landing-password', 'TestPass123!');
    await page.type('#landing-confirm', 'TestPass123!');
    await Promise.all([
      page.click('form.register-form button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 25000 }).catch(() => null),
    ]);
    ok('signup submitted', true, email);
    console.log('  → after signup:', page.url());

    // Onboarding if shown
    if (await page.$('input[name="age_months"]')) {
      const nameInput = await page.$('input[name="name"]');
      if (nameInput) {
        await nameInput.click({ clickCount: 3 });
        await nameInput.type('Aarav');
      }
      await page.type('input[name="age_months"]', '18');
      const gender = await page.$('input[name="gender"][value="male"]');
      if (gender) await gender.click();
      await Promise.all([
        page.click('button[type="submit"]'),
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 25000 }).catch(() => null),
      ]);
      console.log('  → after onboarding:', page.url());
    }

    await page.goto(BASE + '/profile', { waitUntil: 'networkidle2', timeout: 25000 });
    await sleep(1000);
    if (page.url().includes('login')) {
      ok('authenticated profile', false, `redirected to ${page.url()}`);
    } else {
      ok('authenticated profile', true, page.url());
      await page.evaluate(() => {
        document.getElementById('notifications')?.scrollIntoView({ block: 'center' });
      });
      await page.waitForSelector('#notification-settings .notify-settings', { timeout: 10000 });
      const profileShot = path.join(OUT_DIR, 'notify-profile-sandbox.png');
      await page.screenshot({ path: profileShot, fullPage: true });

      const ui = await page.evaluate(() => {
        const enabled = document.querySelector('#notify-enabled');
        const meals = document.querySelector('#notify-meals');
        const alerts = document.querySelector('#notify-alerts');
        const hero = document.querySelector('.notify-hero');
        return {
          found: !!document.querySelector('#notification-settings .notify-settings'),
          enabled: !!(enabled && enabled.checked),
          meals: !!(meals && meals.checked),
          alerts: !!(alerts && alerts.checked),
          hasBadge: !!document.querySelector('.notify-badge'),
          onByDefault: !!(
            document.querySelector('#notifications .badge') ||
            (hero && /on by default/i.test(hero.textContent || ''))
          ),
          hasTest: !!document.querySelector('#notify-test'),
          timeCount: document.querySelectorAll('input[type="time"][data-meal]').length,
        };
      });

      ok('notification settings rendered', ui.found);
      ok('master toggle ON by default', ui.enabled);
      ok('meal reminders ON by default', ui.meals);
      ok('nutrition alerts ON by default', ui.alerts);
      ok('shows on-by-default messaging', ui.onByDefault);
      ok('permission badge present', ui.hasBadge);
      ok('send test button present', ui.hasTest);
      ok('five reminder time inputs', ui.timeCount === 5, `count=${ui.timeCount}`);
      ok('profile screenshot saved', fs.existsSync(profileShot), profileShot);
    }

    // Open first toddler dashboard if listed
    const dashHref = await page.evaluate(() => {
      const a = [...document.querySelectorAll('a[href]')].find((el) =>
        /\/dashboard\//.test(el.getAttribute('href') || '')
      );
      return a ? a.href : null;
    });
    if (dashHref) {
      await page.goto(dashHref, { waitUntil: 'networkidle2', timeout: 25000 });
      await sleep(1500);
      ok('dashboard notify banner mount', !!(await page.$('#notify-dashboard-banner')));
      const dashShot = path.join(OUT_DIR, 'notify-dashboard-sandbox.png');
      await page.screenshot({ path: dashShot, fullPage: true });
      ok('dashboard screenshot saved', fs.existsSync(dashShot), dashShot);
    } else {
      // Create toddler via onboarding then retry
      await page.goto(BASE + '/onboarding', { waitUntil: 'networkidle2' });
      if (await page.$('input[name="age_months"]')) {
        await page.type('input[name="name"]', 'Aarav');
        await page.type('input[name="age_months"]', '18');
        const gender = await page.$('input[name="gender"][value="male"]');
        if (gender) await gender.click();
        await Promise.all([
          page.click('button[type="submit"]'),
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 25000 }).catch(() => null),
        ]);
      }
      const banner = await page.$('#notify-dashboard-banner');
      ok('dashboard notify banner mount', !!banner, page.url());
      if (banner) {
        const dashShot = path.join(OUT_DIR, 'notify-dashboard-sandbox.png');
        await page.screenshot({ path: dashShot, fullPage: true });
        ok('dashboard screenshot saved', fs.existsSync(dashShot), dashShot);
      }
    }
  } catch (err) {
    ok('sandbox run', false, err.stack || err.message);
    try {
      await page.screenshot({
        path: path.join(OUT_DIR, 'notify-sandbox-error.png'),
        fullPage: true,
      });
    } catch (e) { /* ignore */ }
  }

  await browser.close();
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  fs.writeFileSync(
    path.join(OUT_DIR, 'notify-sandbox-results.json'),
    JSON.stringify(results, null, 2)
  );
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
