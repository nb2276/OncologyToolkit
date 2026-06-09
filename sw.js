// Oncology Toolkit service worker.
//
// !! BUMP CACHE_VERSION ON EVERY DEPLOY THAT CHANGES A PRECACHED FILE !!
// The browser detects a new SW only if sw.js bytes differ. If you ship
// new HTML/CSS/JS without bumping, users may serve new HTML against
// stale precached JS until the next bump.
var CACHE_VERSION = 'v14-2026-06-08';
var STATIC_CACHE = 'ot-static-' + CACHE_VERSION;
// DATA_CACHE survives version bumps so the 9 MB ICD-10 XML doesn't
// re-download on every deploy.
var DATA_CACHE = 'ot-data-v1';

// REQUIRED: install fails atomically if any of these fail. Old caches stay,
// old SW keeps controlling tabs — site is never worse than no PWA.
var REQUIRED_PRECACHE = [
  '/',
  '/index.html',
  '/icd.html',
  '/bed.html',
  '/psa.html',
  '/composite.html',
  '/rert.html',
  '/constraints.html',
  '/about.html',
  '/style.css',
  '/math.js',
  '/validate.js',
  '/url-state.js',
  '/history.js',
  '/theme.js',
  '/clipboard.js',
  '/shortcuts.js',
  '/decimals.js',
  '/script.js',
  '/bed.js',
  '/psa.js',
  '/composite.js',
  '/rert.js',
  '/constraints.js',
  '/pwa.js',
  '/constraints-data.json',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/favicon-192.png',
  '/favicon-512.png',
  '/favicon-maskable-512.png',
  '/vendor/chart.umd.min.js',
  '/vendor/chartjs-adapter-date-fns.bundle.min.js'
];

// OPTIONAL: best-effort. Failures here don't fail install.
var OPTIONAL_PRECACHE = [
  '/favicon.png',
  '/favicon-16.png',
  '/favicon-32.png',
  '/favicon-48.png',
  '/favicon-64.png',
  '/favicon-180.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(function (cache) {
      // Atomic addAll: any failure rejects, install fails, old SW survives.
      var requiredReqs = REQUIRED_PRECACHE.map(function (u) {
        return new Request(u, { cache: 'reload' });
      });
      return cache.addAll(requiredReqs).then(function () {
        return Promise.all(OPTIONAL_PRECACHE.map(function (u) {
          return cache.add(new Request(u, { cache: 'reload' })).catch(function () {
            return null;
          });
        }));
      });
    }).then(function () {
      // Activate the new SW as soon as install succeeds. Without this,
      // assets (style.css / *.js) were served cache-first from the OLD
      // SW while index.html came network-first — so any structural change
      // to precached files left existing-PWA users with mismatched
      // HTML + old styles until they fully closed every tab.
      // The mid-session DOM/state desync this used to protect against is
      // theoretical for this site: a session is one calc load, and state
      // lives in inputs + URL params, not in long-lived SW state. The
      // stale-asset bug is concrete, so skipWaiting wins.
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== STATIC_CACHE && k !== DATA_CACHE) return caches.delete(k);
      }));
    }).then(function () {
      // Take control of any open clients immediately so they start using
      // the new SW (and the new cache) on their next fetch, without
      // requiring a full close-and-reopen.
      return self.clients.claim();
    })
  );
});

function isCacheable(resp) {
  // Only cache successful, same-origin, non-redirected responses.
  return resp && resp.ok && resp.type === 'basic' && !resp.redirected;
}

function isXmlResponse(resp) {
  var ct = (resp.headers.get('content-type') || '').toLowerCase();
  return ct.indexOf('xml') !== -1;
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (e) { return; }

  // Skip cross-origin: analytics, fonts, anything we don't control.
  if (url.origin !== self.location.origin) return;

  // ICD-10 / IMRT XML: stale-while-revalidate against a versionless data
  // cache. The 9 MB ICD-10 file persists across deploys, but background
  // revalidation propagates updates on next visit. Content-type is validated
  // so a misrouted same-origin HTML response can't poison the cache.
  if (url.pathname === '/icd10.xml' || url.pathname === '/imrt_codes.xml') {
    event.respondWith(
      caches.open(DATA_CACHE).then(function (cache) {
        return cache.match(req).then(function (cached) {
          var fetchPromise = fetch(req).then(function (resp) {
            if (isCacheable(resp) && isXmlResponse(resp)) {
              return cache.put(req, resp.clone()).then(function () { return resp; });
            }
            return resp;
          }).catch(function () {
            return cached;
          });
          // Anchor the background revalidation to the fetch event so the SW
          // isn't terminated mid-write when we return the cached copy fast.
          if (cached) event.waitUntil(fetchPromise);
          return cached || fetchPromise;
        });
      })
    );
    return;
  }

  // Navigation requests: network-first to ensure freshness post-deploy,
  // fall back to precached page by pathname (ignoreSearch so shareable
  // calculator URLs like /bed.html?bd-dose=60 still resolve offline).
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(function () {
        return caches.match(req, { ignoreSearch: true }).then(function (hit) {
          return hit || caches.match('/index.html');
        });
      })
    );
    return;
  }

  // Static asset: serve precache hit, else go to network. We don't
  // runtime-cache; everything intended to work offline is in REQUIRED_PRECACHE.
  event.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req);
    })
  );
});
