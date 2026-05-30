// Service worker registration. Loaded by every page after main scripts.
//
// Why the controllerchange reload:
//   The SW serves assets cache-first (style.css, *.js) but HTML
//   network-first. When a new SW activates mid-pageload via skipWaiting
//   + clients.claim, the current DOM has already painted with the OLD
//   cache's assets — so a structural change (new HTML referencing new
//   CSS class names, new JS function names) renders unstyled until the
//   user reloads a second time. Listening for `controllerchange` and
//   reloading once auto-heals that mismatch.
//
//   The `refreshing` flag guards against any chance of a loop within a
//   single page load. On the reload triggered by this handler, the new
//   page starts already controlled by the new SW, so `controllerchange`
//   does not fire again.
if ('serviceWorker' in navigator) {
  var refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {
      // Registration failures are non-fatal — the site works fine without offline support.
    });
  });
}
