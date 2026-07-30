/**
 * LittleBowl native-app polish (Capacitor Android + iOS).
 * No-ops in regular browsers. Makes the WebView feel like a product app
 * pointed at http://littlebowl.in — not a generic website wrapper.
 */
(function (global) {
  function isNative() {
    try {
      return !!(global.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
    } catch (e) {
      return /capacitor/i.test(navigator.userAgent || '');
    }
  }

  if (!isNative()) return;

  document.documentElement.classList.add('is-capacitor-app');
  if (document.body) document.body.classList.add('is-capacitor-app');
  else document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('is-capacitor-app');
  });

  const Cap = global.Capacitor;
  const Plugins = Cap.Plugins || {};

  async function readySplash() {
    try {
      if (Plugins.SplashScreen && Plugins.SplashScreen.hide) {
        await Plugins.SplashScreen.hide({ fadeOutDuration: 280 });
      }
    } catch (e) { /* ignore */ }
  }

  async function styleStatusBar() {
    try {
      if (!Plugins.StatusBar) return;
      await Plugins.StatusBar.setBackgroundColor({ color: '#6b8f3c' });
      await Plugins.StatusBar.setStyle({ style: 'DARK' });
      if (Plugins.StatusBar.show) await Plugins.StatusBar.show();
    } catch (e) { /* ignore */ }
  }

  function bindAndroidBackButton() {
    try {
      if (!Plugins.App || !Plugins.App.addListener) return;
      Plugins.App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack || window.history.length > 1) {
          window.history.back();
          return;
        }
        // On root screen, minimize rather than leaving a blank WebView
        if (Plugins.App.minimizeApp) {
          Plugins.App.minimizeApp();
        }
      });
    } catch (e) { /* ignore */ }
  }

  function bindAppState() {
    try {
      if (!Plugins.App || !Plugins.App.addListener) return;
      Plugins.App.addListener('appStateChange', ({ isActive }) => {
        if (isActive && global.LittleBowlNotifications && typeof global.LittleBowlNotifications.resync === 'function') {
          global.LittleBowlNotifications.resync().catch(() => {});
        }
      });
    } catch (e) { /* ignore */ }
  }

  function stripWebOnlyChrome() {
    // Hide PWA / browser install prompts and “open in browser” affordances
    document.querySelectorAll('.lb-a2hs-backdrop, #lb-a2hs-prompt, .pwa-install-banner').forEach((el) => {
      el.remove();
    });
  }

  function injectNativeCss() {
    if (document.getElementById('lb-native-app-css')) return;
    const style = document.createElement('style');
    style.id = 'lb-native-app-css';
    style.textContent = `
      html.is-capacitor-app, html.is-capacitor-app body {
        overscroll-behavior: none;
        -webkit-tap-highlight-color: transparent;
        -webkit-text-size-adjust: 100%;
      }
      html.is-capacitor-app .lb-a2hs-backdrop,
      html.is-capacitor-app #lb-a2hs-prompt,
      html.is-capacitor-app .pwa-install-banner {
        display: none !important;
      }
      /* Safe areas for notches / home indicator */
      html.is-capacitor-app .mobile-header {
        padding-top: max(0.55rem, env(safe-area-inset-top));
      }
      html.is-capacitor-app .bottom-nav,
      html.is-capacitor-app .mobile-bottom-nav {
        padding-bottom: max(0.35rem, env(safe-area-inset-bottom));
      }
      html.is-capacitor-app .app-container {
        min-height: 100dvh;
      }
    `;
    document.head.appendChild(style);
  }

  function bindExternalLinks() {
    document.addEventListener('click', (ev) => {
      const a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
      if (!a) return;
      const href = a.getAttribute('href') || '';
      if (!/^https?:\/\//i.test(href)) return;
      try {
        const u = new URL(href, window.location.href);
        if (u.hostname === window.location.hostname || /(^|\.)littlebowl\.in$/i.test(u.hostname)) {
          return;
        }
        ev.preventDefault();
        if (Plugins.App && Plugins.App.openUrl) {
          Plugins.App.openUrl({ url: u.toString() });
        } else {
          window.open(u.toString(), '_system');
        }
      } catch (e) { /* ignore */ }
    }, true);
  }

  function boot() {
    injectNativeCss();
    stripWebOnlyChrome();
    styleStatusBar();
    bindAndroidBackButton();
    bindAppState();
    bindExternalLinks();
    // Hide splash after first paint
    requestAnimationFrame(() => {
      setTimeout(readySplash, 120);
    });
    // Keep stripping if a2hs injects late
    setTimeout(stripWebOnlyChrome, 1500);
    setTimeout(stripWebOnlyChrome, 5000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
