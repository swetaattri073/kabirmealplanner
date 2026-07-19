/**
 * First-party analytics — page views, visibility heartbeats, unload duration.
 * No third-party trackers. Disabled on /admin pages.
 */
(function () {
    'use strict';

    var path = window.location.pathname || '/';
    if (path.indexOf('/admin') === 0) return;

    var startedAt = Date.now();
    var visibleMs = 0;
    var lastVisibleAt = document.visibilityState === 'visible' ? startedAt : null;
    var sentLeave = false;

    function accumulateVisible() {
        if (lastVisibleAt != null) {
            visibleMs += Date.now() - lastVisibleAt;
            lastVisibleAt = Date.now();
        }
    }

    function payload(eventType, extra) {
        var body = {
            event_type: eventType,
            path: path,
            referrer: document.referrer || '',
            duration_ms: Math.round(visibleMs),
            toddler_id: document.body && document.body.dataset
                ? (document.body.dataset.toddlerId || null)
                : null,
        };
        if (extra) {
            for (var k in extra) {
                if (Object.prototype.hasOwnProperty.call(extra, k)) body[k] = extra[k];
            }
        }
        return body;
    }

    function post(eventType, extra, useBeacon) {
        accumulateVisible();
        var data = payload(eventType, extra);
        var json = JSON.stringify(data);
        if (useBeacon && navigator.sendBeacon) {
            try {
                var blob = new Blob([json], { type: 'application/json' });
                navigator.sendBeacon('/api/analytics/collect', blob);
                return;
            } catch (e) { /* fall through */ }
        }
        try {
            fetch('/api/analytics/collect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                credentials: 'same-origin',
                body: json,
                keepalive: true,
            }).catch(function () {});
        } catch (e) { /* ignore */ }
    }

    // Initial page view
    post('page_view', { duration_ms: 0 }, false);

    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') {
            accumulateVisible();
            lastVisibleAt = null;
            post('page_leave', null, true);
        } else if (document.visibilityState === 'visible') {
            lastVisibleAt = Date.now();
        }
    });

    window.addEventListener('pagehide', function () {
        if (sentLeave) return;
        sentLeave = true;
        accumulateVisible();
        post('page_leave', null, true);
    });

    // Heartbeat while visible (~30s)
    setInterval(function () {
        if (document.visibilityState !== 'visible') return;
        accumulateVisible();
        post('heartbeat', null, false);
    }, 30000);
})();
