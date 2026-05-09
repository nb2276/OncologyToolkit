// Service worker registration. Loaded by every page after main scripts.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {
      // Registration failures are non-fatal — the site works fine without offline support.
    });
  });
}
