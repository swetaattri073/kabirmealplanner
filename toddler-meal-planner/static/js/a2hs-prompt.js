/**
 * LittleBowl — Add to Home Screen prompt
 *
 * First show after 1 minute on site, then again after 15 min, 30 min, 45 min…
 * (15 × n minutes after the nth show) until the user installs. Stops when
 * running as an installed PWA / standalone.
 */
(function () {
  const STORAGE_KEY = 'littlebowl_a2hs_pref';
  const FIRST_DELAY_MS = 60 * 1000;
  const REPEAT_STEP_MS = 15 * 60 * 1000;
  const APP_NAME = 'LittleBowl';

  let deferredPrompt = null;
  let activityStarted = Date.now();
  let timerId = null;

  function isStandalone() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://')
    );
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...getPref(),
        ...value,
        at: Date.now(),
      }));
    } catch (e) { /* ignore */ }
  }

  function timesShown() {
    return Math.max(0, Number(getPref().timesShown) || 0);
  }

  /** Delay until the next offer, given how many times we've already shown. */
  function delayAfterShows(shownCount) {
    if (shownCount <= 0) return FIRST_DELAY_MS;
    return shownCount * REPEAT_STEP_MS; // 15m, 30m, 45m, …
  }

  function shouldOffer() {
    if (isStandalone()) return false;
    if (getPref().action === 'installed') return false;
    return true;
  }

  function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function ensureStyles() {
    if (document.getElementById('lb-a2hs-styles')) return;
    const style = document.createElement('style');
    style.id = 'lb-a2hs-styles';
    style.textContent = `
      .lb-a2hs-backdrop {
        position: fixed; inset: 0; z-index: 10000;
        background: rgba(15, 23, 42, 0.45);
        display: flex; align-items: flex-end; justify-content: center;
        padding: 1rem; box-sizing: border-box;
        -webkit-backdrop-filter: blur(2px); backdrop-filter: blur(2px);
      }
      @media (min-width: 640px) {
        .lb-a2hs-backdrop { align-items: center; }
      }
      .lb-a2hs-card {
        width: 100%; max-width: 420px;
        background: #fffaf0;
        border-radius: 1.25rem;
        padding: 1.35rem 1.25rem 1.25rem;
        box-shadow: 0 20px 50px rgba(0,0,0,0.25);
        font-family: Nunito, system-ui, sans-serif;
        color: #1e293b;
        animation: lbA2hsIn 0.35s ease;
      }
      @keyframes lbA2hsIn {
        from { opacity: 0; transform: translateY(18px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .lb-a2hs-top { display: flex; gap: 0.9rem; align-items: center; margin-bottom: 0.85rem; }
      .lb-a2hs-icon {
        width: 56px; height: 56px; border-radius: 14px;
        object-fit: cover; background: #fff; flex-shrink: 0;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      }
      .lb-a2hs-title { font-size: 1.15rem; font-weight: 800; margin: 0 0 0.2rem; letter-spacing: -0.02em; }
      .lb-a2hs-title .lb-little { color: #6b8f3c; }
      .lb-a2hs-title .lb-bowl { color: #f97316; }
      .lb-a2hs-sub { margin: 0; font-size: 0.9rem; color: #64748b; font-weight: 600; }
      .lb-a2hs-body { font-size: 0.95rem; line-height: 1.45; color: #334155; margin: 0 0 1rem; }
      .lb-a2hs-body strong { color: #1e293b; }
      .lb-a2hs-ios {
        display: none; font-size: 0.85rem; line-height: 1.45;
        background: rgba(107,143,60,0.1); border-radius: 0.75rem;
        padding: 0.75rem 0.85rem; margin: 0 0 1rem; color: #3f6212;
      }
      .lb-a2hs-ios.visible { display: block; }
      .lb-a2hs-actions { display: flex; flex-direction: column; gap: 0.55rem; }
      @media (min-width: 420px) {
        .lb-a2hs-actions { flex-direction: row-reverse; }
        .lb-a2hs-actions .lb-a2hs-btn { flex: 1; }
      }
      .lb-a2hs-btn {
        appearance: none; border: none; border-radius: 999px;
        padding: 0.85rem 1rem; font-weight: 800; font-size: 0.95rem;
        font-family: inherit; cursor: pointer;
        display: inline-flex; align-items: center; justify-content: center; gap: 0.45rem;
      }
      .lb-a2hs-btn-primary {
        background: linear-gradient(135deg, #6b8f3c, #84a84b);
        color: #fff; box-shadow: 0 8px 20px rgba(107,143,60,0.35);
      }
      .lb-a2hs-btn-secondary {
        background: transparent; color: #64748b; border: 2px solid #e2e8f0;
      }
      .lb-a2hs-btn:active { transform: scale(0.98); }
      .lb-a2hs-btn:disabled { opacity: 0.65; cursor: wait; }
    `;
    document.head.appendChild(style);
  }

  function hidePrompt() {
    const el = document.getElementById('lb-a2hs-prompt');
    if (el) el.remove();
  }

  function dismissAndReschedule() {
    hidePrompt();
    const shown = timesShown();
    const delay = delayAfterShows(shown);
    setPref({
      action: 'dismissed',
      timesShown: shown,
      nextAt: Date.now() + delay,
    });
    schedulePrompt();
  }

  async function installOrGuide() {
    const primary = document.getElementById('lb-a2hs-install');
    if (primary) {
      primary.disabled = true;
      primary.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Opening…';
    }

    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        deferredPrompt = null;
        if (choice.outcome === 'accepted') {
          setPref({ action: 'installed', nextAt: null });
          hidePrompt();
          clearTimeout(timerId);
          return;
        }
        if (primary) {
          primary.disabled = false;
          primary.innerHTML = '<i class="fas fa-mobile-alt"></i> Save to home screen';
        }
        return;
      } catch (e) {
        console.warn('A2HS prompt failed', e);
      }
    }

    if (isIos()) {
      const tip = document.getElementById('lb-a2hs-ios-tip');
      if (tip) tip.classList.add('visible');
      if (primary) {
        primary.disabled = false;
        primary.innerHTML = '<i class="fas fa-share-square"></i> Follow steps below';
      }
      return;
    }

    const tip = document.getElementById('lb-a2hs-ios-tip');
    if (tip) {
      tip.innerHTML = 'Use your browser menu → <strong>Install app</strong> or <strong>Add to Home screen</strong>. The app will appear as <strong>LittleBowl</strong>.';
      tip.classList.add('visible');
    }
    if (primary) {
      primary.disabled = false;
      primary.innerHTML = '<i class="fas fa-mobile-alt"></i> Save to home screen';
    }
  }

  function showPrompt() {
    if (!shouldOffer()) return;
    if (document.getElementById('lb-a2hs-prompt')) return;

    const nextCount = timesShown() + 1;
    setPref({
      action: 'prompted',
      timesShown: nextCount,
      nextAt: null,
    });

    ensureStyles();

    const iosTip = isIos()
      ? `On iPhone/iPad: tap <strong>Share</strong> <span aria-hidden="true">⎋</span> → <strong>Add to Home Screen</strong> → open as <strong>${APP_NAME}</strong>.`
      : `If the install popup doesn’t appear, open your browser menu and choose <strong>Install app</strong> / <strong>Add to Home screen</strong>. It will be named <strong>${APP_NAME}</strong>.`;

    const wrap = document.createElement('div');
    wrap.id = 'lb-a2hs-prompt';
    wrap.className = 'lb-a2hs-backdrop';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-labelledby', 'lb-a2hs-heading');
    wrap.innerHTML = `
      <div class="lb-a2hs-card">
        <div class="lb-a2hs-top">
          <img class="lb-a2hs-icon" src="/static/images/littlebowl-mark.png" alt="${APP_NAME}" width="56" height="56">
          <div>
            <h2 class="lb-a2hs-title" id="lb-a2hs-heading">
              <span class="lb-little">Little</span><span class="lb-bowl">Bowl</span>
            </h2>
            <p class="lb-a2hs-sub">Enjoying it so far?</p>
          </div>
        </div>
        <p class="lb-a2hs-body">
          Add <strong>${APP_NAME}</strong> to your home screen so you don’t miss meal plans —
          and keep sharing your little one’s progress in one tap.
        </p>
        <div class="lb-a2hs-ios" id="lb-a2hs-ios-tip">${iosTip}</div>
        <div class="lb-a2hs-actions">
          <button type="button" class="lb-a2hs-btn lb-a2hs-btn-primary" id="lb-a2hs-install">
            <i class="fas fa-mobile-alt"></i> Save to home screen
          </button>
          <button type="button" class="lb-a2hs-btn lb-a2hs-btn-secondary" id="lb-a2hs-ignore">
            Ignore
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    if (isIos() && !deferredPrompt) {
      document.getElementById('lb-a2hs-ios-tip')?.classList.add('visible');
    }

    document.getElementById('lb-a2hs-ignore')?.addEventListener('click', () => {
      dismissAndReschedule();
    });
    document.getElementById('lb-a2hs-install')?.addEventListener('click', () => {
      installOrGuide();
    });
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap) {
        dismissAndReschedule();
      }
    });
  }

  function runWhenVisible(fn) {
    if (document.visibilityState === 'visible') {
      fn();
      return;
    }
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        document.removeEventListener('visibilitychange', onVis);
        setTimeout(fn, 1500);
      }
    };
    document.addEventListener('visibilitychange', onVis);
  }

  function schedulePrompt() {
    if (!shouldOffer()) {
      clearTimeout(timerId);
      return;
    }
    clearTimeout(timerId);

    const pref = getPref();
    let wait;
    if (pref.nextAt && Number(pref.nextAt) > Date.now()) {
      wait = Number(pref.nextAt) - Date.now();
    } else if (timesShown() > 0 && pref.nextAt && Number(pref.nextAt) <= Date.now()) {
      // Due from a previous visit — show shortly
      wait = 1500;
    } else if (timesShown() > 0) {
      // Shown before but no nextAt (legacy) — use step from show count
      wait = delayAfterShows(timesShown());
      setPref({ nextAt: Date.now() + wait, action: pref.action || 'dismissed' });
    } else {
      // First offer: 1 minute from this page activity start
      wait = Math.max(0, FIRST_DELAY_MS - (Date.now() - activityStarted));
    }

    timerId = setTimeout(() => {
      runWhenVisible(showPrompt);
    }, wait);
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });

  window.addEventListener('appinstalled', () => {
    setPref({ action: 'installed', nextAt: null });
    hidePrompt();
    deferredPrompt = null;
    clearTimeout(timerId);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedulePrompt);
  } else {
    schedulePrompt();
  }
})();
