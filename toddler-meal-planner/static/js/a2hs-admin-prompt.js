/**
 * LittleBowl Admin — Add to Home Screen (separate PWA from parent app)
 * start_url=/admin · storage key separate from consumer A2HS
 */
(function () {
  const STORAGE_KEY = 'littlebowl_admin_a2hs_pref';
  const FIRST_DELAY_MS = 8 * 1000;
  const APP_NAME = 'LittleBowl Admin';
  const MANIFEST = '/static/manifest-admin.json';
  const SW_URL = '/admin/sw.js';

  let deferredPrompt = null;
  let timerId = null;

  function isStandalone() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://')
    );
  }

  function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function getPref() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || {};
    } catch (e) {
      return {};
    }
  }

  function setPref(value) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...getPref(), ...value, at: Date.now() }));
    } catch (e) { /* ignore */ }
  }

  function shouldOffer() {
    if (isStandalone()) return false;
    if (getPref().action === 'installed') return false;
    return true;
  }

  function registerAdminSw() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register(SW_URL, { scope: '/admin' }).catch((err) => {
      console.warn('Admin SW registration failed', err);
    });
  }

  function ensureStyles() {
    if (document.getElementById('lb-admin-a2hs-styles')) return;
    const style = document.createElement('style');
    style.id = 'lb-admin-a2hs-styles';
    style.textContent = `
      .lb-admin-a2hs-backdrop {
        position: fixed; inset: 0; z-index: 10000;
        background: rgba(0,0,0,0.5);
        display: flex; align-items: flex-end; justify-content: center;
        padding: 1rem; box-sizing: border-box;
      }
      @media (min-width: 640px) { .lb-admin-a2hs-backdrop { align-items: center; } }
      .lb-admin-a2hs-card {
        width: 100%; max-width: 420px; background: #f7f4ec;
        border-radius: 1.15rem; padding: 1.25rem;
        box-shadow: 0 20px 50px rgba(0,0,0,0.35);
        font-family: Nunito, system-ui, sans-serif; color: #1a1f16;
      }
      .lb-admin-a2hs-title { font-size: 1.15rem; font-weight: 800; margin: 0 0 0.35rem; }
      .lb-admin-a2hs-body { font-size: 0.95rem; line-height: 1.45; color: #3f4a36; margin: 0 0 0.85rem; }
      .lb-admin-a2hs-ios {
        display: none; font-size: 0.85rem; line-height: 1.45;
        background: rgba(26,31,22,0.08); border-radius: 0.75rem;
        padding: 0.75rem; margin: 0 0 0.85rem; color: #3f4a36;
      }
      .lb-admin-a2hs-ios.visible { display: block; }
      .lb-admin-a2hs-actions { display: flex; flex-direction: column; gap: 0.5rem; }
      @media (min-width: 420px) {
        .lb-admin-a2hs-actions { flex-direction: row-reverse; }
        .lb-admin-a2hs-actions button { flex: 1; }
      }
      .lb-admin-a2hs-btn {
        appearance: none; border: none; border-radius: 999px;
        padding: 0.8rem 1rem; font-weight: 800; font-size: 0.95rem;
        font-family: inherit; cursor: pointer;
      }
      .lb-admin-a2hs-btn-primary { background: #1a1f16; color: #f7f4ec; }
      .lb-admin-a2hs-btn-secondary { background: transparent; color: #66715c; border: 2px solid #d5d2c8; }
      .lb-admin-install-inline {
        margin-top: 1rem; width: 100%;
        appearance: none; border: 2px solid #1a1f16; background: transparent;
        color: #1a1f16; border-radius: 999px; padding: 0.75rem 1rem;
        font-weight: 800; font-family: inherit; cursor: pointer; font-size: 0.9rem;
      }
      .lb-admin-install-inline.hidden, .lb-admin-install-bar.hidden { display: none !important; }
      .lb-admin-install-bar {
        position: sticky; top: 0; z-index: 50;
        background: #1a1f16; color: #f7f4ec;
        padding: 0.65rem 1rem; display: flex; gap: 0.75rem;
        align-items: center; justify-content: space-between; flex-wrap: wrap;
        font-family: Nunito, system-ui, sans-serif; font-size: 0.9rem;
      }
      .lb-admin-install-bar button {
        appearance: none; border: none; border-radius: 999px;
        padding: 0.45rem 0.85rem; font-weight: 800; cursor: pointer;
        background: #f7f4ec; color: #1a1f16; font-family: inherit;
      }
    `;
    document.head.appendChild(style);
  }

  function hidePrompt() {
    document.getElementById('lb-admin-a2hs-prompt')?.remove();
  }

  function markInstalled() {
    setPref({ action: 'installed', nextAt: null });
    hidePrompt();
    document.querySelectorAll('.lb-admin-install-inline, .lb-admin-install-bar').forEach((el) => {
      el.classList.add('hidden');
    });
    clearTimeout(timerId);
  }

  async function installOrGuide() {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        deferredPrompt = null;
        if (choice.outcome === 'accepted') {
          markInstalled();
          return;
        }
      } catch (e) {
        console.warn('Admin A2HS failed', e);
      }
    }

    ensureStyles();
    showPrompt(true);
  }

  function showPrompt(forceTips) {
    if (!shouldOffer() && !forceTips) return;
    if (document.getElementById('lb-admin-a2hs-prompt')) return;
    ensureStyles();

    if (!forceTips) {
      setPref({ action: 'prompted', timesShown: (Number(getPref().timesShown) || 0) + 1 });
    }

    const iosTip = isIos()
      ? `On iPhone/iPad: open this page in <strong>Safari</strong> → tap <strong>Share</strong> → <strong>Add to Home Screen</strong>. Name it <strong>${APP_NAME}</strong>. It will open at admin login.`
      : `On Android/Chrome: use <strong>Install app</strong> / <strong>Add to Home screen</strong>. The icon will be <strong>${APP_NAME}</strong> and open at <strong>/admin</strong>.`;

    const wrap = document.createElement('div');
    wrap.id = 'lb-admin-a2hs-prompt';
    wrap.className = 'lb-admin-a2hs-backdrop';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.innerHTML = `
      <div class="lb-admin-a2hs-card">
        <h2 class="lb-admin-a2hs-title">Install admin app</h2>
        <p class="lb-admin-a2hs-body">
          Save <strong>${APP_NAME}</strong> to your phone home screen for quick operator login —
          separate from the parent LittleBowl app.
        </p>
        <div class="lb-admin-a2hs-ios ${isIos() || forceTips ? 'visible' : ''}" id="lb-admin-a2hs-ios-tip">${iosTip}</div>
        <div class="lb-admin-a2hs-actions">
          <button type="button" class="lb-admin-a2hs-btn lb-admin-a2hs-btn-primary" id="lb-admin-a2hs-install">
            ${deferredPrompt ? 'Install now' : (isIos() ? 'Show iOS steps' : 'Install / Add to Home')}
          </button>
          <button type="button" class="lb-admin-a2hs-btn lb-admin-a2hs-btn-secondary" id="lb-admin-a2hs-ignore">Not now</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    document.getElementById('lb-admin-a2hs-ignore')?.addEventListener('click', () => {
      hidePrompt();
      setPref({ action: 'dismissed', nextAt: Date.now() + 30 * 60 * 1000 });
    });
    document.getElementById('lb-admin-a2hs-install')?.addEventListener('click', () => {
      if (deferredPrompt) {
        installOrGuide();
      } else {
        document.getElementById('lb-admin-a2hs-ios-tip')?.classList.add('visible');
      }
    });
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap) hidePrompt();
    });
  }

  function mountInlineButtons() {
    if (!shouldOffer()) return;
    ensureStyles();

    // Login page button
    const loginCard = document.querySelector('.admin-login-card');
    if (loginCard && !document.getElementById('lb-admin-install-login')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'lb-admin-install-login';
      btn.className = 'lb-admin-install-inline';
      btn.innerHTML = '<i class="fas fa-mobile-alt"></i> Add Admin app to Home Screen';
      btn.addEventListener('click', () => installOrGuide());
      loginCard.appendChild(btn);
    }

    // Dashboard / content sticky bar
    if (document.querySelector('.admin-header') && !document.getElementById('lb-admin-install-bar')) {
      const bar = document.createElement('div');
      bar.id = 'lb-admin-install-bar';
      bar.className = 'lb-admin-install-bar';
      bar.innerHTML = `
        <span>Install <strong>LittleBowl Admin</strong> on your phone home screen for faster login.</span>
        <span style="display:flex;gap:0.4rem;">
          <button type="button" id="lb-admin-install-bar-btn">Install</button>
          <button type="button" id="lb-admin-install-bar-dismiss" style="background:transparent;color:#f7f4ec;border:1px solid #55604a;">Dismiss</button>
        </span>
      `;
      const container = document.querySelector('.app-container .main-content') || document.querySelector('.app-container') || document.body;
      container.insertBefore(bar, container.firstChild);
      document.getElementById('lb-admin-install-bar-btn')?.addEventListener('click', () => installOrGuide());
      document.getElementById('lb-admin-install-bar-dismiss')?.addEventListener('click', () => {
        bar.classList.add('hidden');
        setPref({ action: 'dismissed', nextAt: Date.now() + 24 * 60 * 60 * 1000 });
      });
    }
  }

  window.installLittleBowlAdminApp = installOrGuide;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });

  window.addEventListener('appinstalled', () => {
    markInstalled();
    deferredPrompt = null;
  });

  function init() {
    registerAdminSw();
    // Ensure admin manifest is linked (login page adds it in HTML; dashboard overrides via block)
    if (!document.querySelector('link[rel="manifest"][href*="manifest-admin"]')) {
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = MANIFEST;
      document.head.appendChild(link);
    }
    mountInlineButtons();
    if (!shouldOffer()) return;
    timerId = setTimeout(() => {
      if (shouldOffer() && !document.getElementById('lb-admin-a2hs-prompt')) {
        showPrompt(false);
      }
    }, FIRST_DELAY_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
