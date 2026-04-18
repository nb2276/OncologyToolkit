// Global decimal-places preference, shared by BED / Composite / ReRT.
// Persists to localStorage['decimalPlaces']. Default 2.
// Pages listen for the 'decimalschange' event to re-render.
// Mounts a selector into any #decimals-control element present on the page.

(function () {
  var KEY = 'decimalPlaces';
  var DEFAULT = 2;
  var MIN = 0;
  var MAX = 4;

  function getDecimals() {
    var v = parseInt(localStorage.getItem(KEY), 10);
    if (isNaN(v) || v < MIN || v > MAX) return DEFAULT;
    return v;
  }

  function setDecimals(n) {
    n = parseInt(n, 10);
    if (isNaN(n) || n < MIN || n > MAX) n = DEFAULT;
    localStorage.setItem(KEY, String(n));
    document.dispatchEvent(new CustomEvent('decimalschange', { detail: n }));
  }

  function mount(host) {
    host.classList.add('decimals-control');
    host.innerHTML =
      '<label class="decimals-label" for="decimals-select">Decimals:</label>' +
      '<select id="decimals-select" class="decimals-select" aria-label="Decimal places">' +
        '<option value="0">0</option>' +
        '<option value="1">1</option>' +
        '<option value="2">2</option>' +
        '<option value="3">3</option>' +
        '<option value="4">4</option>' +
      '</select>';
    var sel = host.querySelector('#decimals-select');
    sel.value = String(getDecimals());
    sel.addEventListener('change', function () { setDecimals(sel.value); });
  }

  function init() {
    var host = document.getElementById('decimals-control');
    if (host) mount(host);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.getDecimals = getDecimals;
  window.setDecimals = setDecimals;
})();
