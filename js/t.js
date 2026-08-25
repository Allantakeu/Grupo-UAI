(function () {
    'use strict';

    var COOKIE_NAME = '_cloak_cvid';
    var STORAGE_KEY = '_cloak_cvid';
    var COOKIE_DAYS = 30;
    var DEDUP_MS = 5000;
    var HEARTBEAT_MS = 25000;

    function isValidUuid(str) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    }

    function setCookie(name, value, days) {
        var expires = new Date(Date.now() + days * 864e5).toUTCString();
        document.cookie = name + '=' + encodeURIComponent(value)
            + ';expires=' + expires + ';path=/;SameSite=Lax'
            + (location.protocol === 'https:' ? ';Secure' : '');
    }

    function getCookie(name) {
        var match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
        return match ? decodeURIComponent(match[1]) : null;
    }

    // Auto-captura e persistência instantânea do CVID no momento zero de execução do script
    (function captureImmediate() {
        try {
            var urlMatch = (window.location.search || '').match(/[?&]cvid=([0-9a-f-]{36})/i)
                || (window.location.hash || '').match(/[#&?]cvid=([0-9a-f-]{36})/i);
            if (urlMatch && isValidUuid(urlMatch[1])) {
                var found = urlMatch[1];
                setCookie(COOKIE_NAME, found, COOKIE_DAYS);
                try { sessionStorage.setItem(STORAGE_KEY, found); } catch (e) {}
                try { localStorage.setItem(STORAGE_KEY, found); } catch (e) {}
            }
        } catch (e) {}
    })();

    var queue = window._cloak;
    var pending = (queue && queue.q) || [];
    var config = { xid: null, step: null, endpoint: null };
    var lastSent = {};
    var clickBound = false;
    var lifecycleBound = false;
    var heartbeatTimer = null;
    var isLeaving = false;

    function resolveTrackUrl() {
        if (config.endpoint && typeof config.endpoint === 'string' && config.endpoint.indexOf('http') === 0) {
            return config.endpoint;
        }

        var scripts = document.getElementsByTagName('script');

        for (var i = scripts.length - 1; i >= 0; i--) {
            var src = scripts[i].src || '';

            if (!/(^|\/)t\.js(\?|#|$)/i.test(src)) {
                continue;
            }

            try {
                // /api/f evita bloqueio de ad blockers que filtram URLs com "track"
                return new URL('/api/f', src).href;
            } catch (e) {}
        }

        return '/api/f';
    }

    function normalizeStep(step) {
        if (!step) {
            return step;
        }

        return String(step).toLowerCase().trim().replace(/\s+/g, '-');
    }

    function process(cmd, data) {
        if (cmd === 'init') {
            config.xid = data.xid;
            config.step = normalizeStep(data.step);
            if (data.endpoint) {
                config.endpoint = data.endpoint;
            }
            setupCvidPropagation();
            track();
            startHeartbeat();
            bindPageLifecycle();
        }
    }

    function resolveCvid() {
        // 1. URL search (?cvid=...)
        try {
            var params = new URLSearchParams(window.location.search);
            var fromUrl = params.get('cvid');
            if (fromUrl && isValidUuid(fromUrl)) {
                persistCvid(fromUrl);
                return fromUrl;
            }
        } catch (e) {}

        // 2. URL hash (#cvid=... ou #...&cvid=...)
        try {
            var hash = window.location.hash || '';
            var matchHash = hash.match(/[#&?]cvid=([0-9a-f-]{36})/i);
            if (matchHash && isValidUuid(matchHash[1])) {
                persistCvid(matchHash[1]);
                return matchHash[1];
            }
        } catch (e) {}

        // 3. Document Referrer (se a URL anterior tiver o cvid)
        try {
            var ref = document.referrer || '';
            var matchRef = ref.match(/[?&]cvid=([0-9a-f-]{36})/i);
            if (matchRef && isValidUuid(matchRef[1])) {
                persistCvid(matchRef[1]);
                return matchRef[1];
            }
        } catch (e) {}

        // 4. Session Storage
        try {
            var fromSession = sessionStorage.getItem(STORAGE_KEY);
            if (fromSession && isValidUuid(fromSession)) {
                return fromSession;
            }
        } catch (e) {}

        // 5. Local Storage
        try {
            var fromStorage = localStorage.getItem(STORAGE_KEY);
            if (fromStorage && isValidUuid(fromStorage)) {
                return fromStorage;
            }
        } catch (e) {}

        // 6. Cookie
        var fromCookie = getCookie(COOKIE_NAME);
        if (fromCookie && isValidUuid(fromCookie)) {
            return fromCookie;
        }

        // 7. Fallback: 'auto' para o backend reconciliar pelo IP do clique recente
        return 'auto';
    }

    function persistCvid(cvid) {
        if (!cvid || cvid === 'auto') return;

        setCookie(COOKIE_NAME, cvid, COOKIE_DAYS);

        try {
            sessionStorage.setItem(STORAGE_KEY, cvid);
        } catch (e) {}

        try {
            localStorage.setItem(STORAGE_KEY, cvid);
        } catch (e) {}
    }

    function syncCvidToUrl(cvid) {
        var params = new URLSearchParams(window.location.search);

        if (params.get('cvid') === cvid) {
            return;
        }

        params.set('cvid', cvid);
        var query = params.toString();
        var newUrl = window.location.pathname
            + (query ? '?' + query : '')
            + window.location.hash;

        history.replaceState(null, '', newUrl);
    }

    function decorateLink(anchor, cvid) {
        try {
            var linkUrl = new URL(anchor.href, window.location.origin);

            if (linkUrl.hostname !== window.location.hostname) {
                return;
            }

            if (linkUrl.searchParams.has('cvid')) {
                return;
            }

            linkUrl.searchParams.set('cvid', cvid);
            anchor.href = linkUrl.toString();
        } catch (err) {}
    }

    function decorateAllLinks(cvid) {
        var anchors = document.querySelectorAll('a[href]');

        for (var i = 0; i < anchors.length; i++) {
            decorateLink(anchors[i], cvid);
        }
    }

    function setupCvidPropagation() {
        var cvid = resolveCvid();

        if (!cvid) {
            return;
        }

        syncCvidToUrl(cvid);

        function onReady() {
            decorateAllLinks(cvid);
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', onReady);
        } else {
            onReady();
        }

        if (!clickBound) {
            clickBound = true;

            document.addEventListener('click', function (e) {
                var currentCvid = resolveCvid();

                if (!currentCvid) {
                    return;
                }

                var anchor = e.target.closest('a[href]');

                if (!anchor) {
                    return;
                }

                decorateLink(anchor, currentCvid);
            }, true);
        }
    }

    function resolveNavigationTiming() {
        try {
            if (window.performance) {
                var entries = performance.getEntriesByType && performance.getEntriesByType('navigation');
                if (entries && entries.length > 0) {
                    var nav = entries[0];
                    if (nav.redirectEnd > 0 && nav.redirectStart > 0) {
                        return Math.max(1, Math.round(nav.redirectEnd - nav.redirectStart));
                    }
                    if (nav.responseStart > 0 && nav.requestStart > 0) {
                        return Math.max(1, Math.round(nav.responseStart - nav.requestStart));
                    }
                    if (nav.domContentLoadedEventEnd > 0) {
                        return Math.max(1, Math.round(nav.domContentLoadedEventEnd));
                    }
                    if (nav.responseEnd > 0) {
                        return Math.max(1, Math.round(nav.responseEnd));
                    }
                }
                if (performance.timing) {
                    var t = performance.timing;
                    if (t.redirectEnd > 0 && t.redirectStart > 0) {
                        return Math.max(1, Math.round(t.redirectEnd - t.redirectStart));
                    }
                    if (t.responseStart > 0 && t.navigationStart > 0) {
                        return Math.max(1, Math.round(t.responseStart - t.navigationStart));
                    }
                }
                if (performance.now) {
                    return Math.max(1, Math.round(performance.now()));
                }
            }
        } catch (e) {}

        return null;
    }

    function buildPayload(cvid, left, ms) {
        var data = {
            xid: config.xid,
            cvid: cvid,
            step: config.step,
            url: window.location.href,
            ts: Math.floor(Date.now() / 1000),
        };

        if (typeof ms === 'number' && ms > 0) {
            data.ms = ms;
        }

        if (left) {
            data.left = true;
        }

        return JSON.stringify(data);
    }

    function track() {
        if (!config.xid || !config.step) {
            return;
        }

        var cvid = resolveCvid();

        if (!cvid) {
            return;
        }

        var dedupKey = config.step + '|' + window.location.href;

        if (lastSent[dedupKey] && Date.now() - lastSent[dedupKey] < DEDUP_MS) {
            return;
        }

        lastSent[dedupKey] = Date.now();
        var ms = resolveNavigationTiming();
        sendPayload(buildPayload(cvid, false, ms));
    }

    function pulse() {
        if (isLeaving || !config.xid || !config.step) {
            return;
        }

        var cvid = resolveCvid();

        if (!cvid) {
            return;
        }

        sendPayload(buildPayload(cvid));
    }

    function startHeartbeat() {
        if (heartbeatTimer) {
            return;
        }

        heartbeatTimer = setInterval(pulse, HEARTBEAT_MS);
    }

    function stopHeartbeat() {
        if (!heartbeatTimer) {
            return;
        }

        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }

    function sendLeave() {
        if (isLeaving || !config.xid || !config.step) {
            return;
        }

        var cvid = resolveCvid();

        if (!cvid) {
            return;
        }

        isLeaving = true;
        stopHeartbeat();

        sendLeavePayload(buildPayload(cvid, true));
    }

    function sendLeavePayload(payload) {
        var trackUrl = resolveTrackUrl();
        if (typeof fetch === 'function') {
            fetch(trackUrl, {
                method: 'POST',
                body: payload,
                mode: 'cors',
                credentials: 'omit',
                keepalive: true,
            }).catch(function () {
                beaconPayload(payload);
            });

            return;
        }

        beaconPayload(payload);
    }

    function bindPageLifecycle() {
        if (lifecycleBound) {
            return;
        }

        lifecycleBound = true;

        window.addEventListener('pagehide', sendLeave);

        window.addEventListener('pageshow', function (event) {
            if (event.persisted) {
                isLeaving = false;
                track();
                startHeartbeat();
            }
        });
    }

    function sendPayload(payload) {
        var trackUrl = resolveTrackUrl();
        if (typeof fetch === 'function') {
            fetch(trackUrl, {
                method: 'POST',
                body: payload,
                mode: 'cors',
                credentials: 'omit',
                keepalive: true,
            }).catch(function () {
                beaconPayload(payload);
            });

            return;
        }

        beaconPayload(payload);
    }

    function beaconPayload(payload) {
        if (!navigator.sendBeacon) {
            return;
        }

        var trackUrl = resolveTrackUrl();
        try {
            var blob = new Blob([payload], { type: 'text/plain' });
            if (!navigator.sendBeacon(trackUrl, blob)) {
                navigator.sendBeacon(trackUrl, payload);
            }
        } catch (e) {
            navigator.sendBeacon(trackUrl, payload);
        }
    }

    for (var i = 0; i < pending.length; i++) {
        process(pending[i][0], pending[i][1]);
    }

    window._cloak = process;
})();
