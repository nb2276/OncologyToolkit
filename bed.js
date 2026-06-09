// calcBED, calcEQD2, isoeffDose, fmt provided by math.js
// copyToClipboard provided by clipboard.js
// parseUrlParams, applyUrlParams, serializeToUrl, initUrlParams, setupCopyLinkButton provided by url-state.js
// saveToHistory, renderHistory provided by history.js

var BED_INPUT_IDS = ['bd-dose', 'bd-fx', 'ab1', 'ab2', 'ab3', 'arb-fx'];

// Input validation ranges. Max fractions is 80 — beyond that is essentially
// always a fat-finger error (max real-world regimen we'd expect is ~45 fx).
var BED_RANGES = {
  'bd-dose': { min: 0.1, max: 200, label: 'Typical: 1–80 Gy' },
  'bd-fx':   { min: 1,   max: 80,  label: 'Typical: 1–45 fx (>80 is rare)' },
  'ab1':     { min: 0.1, max: 30,  label: 'Typical: 1–20 Gy' },
  'ab2':     { min: 0.1, max: 30,  label: 'Typical: 1–20 Gy' },
  'ab3':     { min: 0.1, max: 30,  label: 'Typical: 1–20 Gy' },
  'arb-fx':  { min: 1,   max: 80,  label: 'Typical: 1–45 fx (>80 is rare)' }
};

function validateInputs() {
  Object.keys(BED_RANGES).forEach(function (id) {
    var el = document.getElementById(id);
    var warn = document.getElementById('warn-' + id);
    if (!el || !warn) return;
    applyRangeWarning(el, warn, BED_RANGES[id]);
  });
}

function update() {
  var D  = parseFloat(document.getElementById('bd-dose').value);
  var n  = parseFloat(document.getElementById('bd-fx').value);
  var ab = [
    parseFloat(document.getElementById('ab1').value),
    parseFloat(document.getElementById('ab2').value),
    parseFloat(document.getElementById('ab3').value),
  ];

  // Reflect current α/β values in the alternative fractionation header
  for (var i = 0; i < 3; i++) {
    var el = document.getElementById('ab' + (i + 1) + '-disp');
    if (el) el.textContent = isNaN(ab[i]) ? '?' : ab[i];
  }

  // Dose per fraction display
  var dpfEl = document.getElementById('dpf-val');
  if (dpfEl) {
    dpfEl.textContent = (D > 0 && n >= 1) ? fmt(D / n) : '—';
  }

  var valid = !isNaN(D) && !isNaN(n) && D > 0 && n >= 1 && ab.every(function (a) { return !isNaN(a) && a > 0; });
  var beds = valid ? ab.map(function (a) { return calcBED(D, n, a); })  : [null, null, null];
  var eqds = valid ? ab.map(function (a) { return calcEQD2(D, n, a); }) : [null, null, null];

  for (var i = 0; i < 3; i++) {
    document.getElementById('bed' + (i + 1)).textContent = fmt(beds[i]);
    document.getElementById('eqd' + (i + 1)).textContent = fmt(eqds[i]);
  }

  var arbFx = parseFloat(document.getElementById('arb-fx').value);
  var arbOk = !isNaN(arbFx) && arbFx >= 1;

  for (var i = 0; i < 3; i++) {
    var b = beds[i];
    var a = ab[i];
    var goodBed = b !== null && !isNaN(a) && a > 0;

    document.getElementById('alt1-' + (i + 1)).textContent =
      goodBed ? fmt(isoeffDose(b, 1, a)) + ' Gy' : '—';
    document.getElementById('alt3-' + (i + 1)).textContent =
      goodBed ? fmt(isoeffDose(b, 3, a)) + ' Gy' : '—';
    document.getElementById('alt5-' + (i + 1)).textContent =
      goodBed ? fmt(isoeffDose(b, 5, a)) + ' Gy' : '—';
    document.getElementById('altA-' + (i + 1)).textContent =
      (goodBed && arbOk) ? fmt(isoeffDose(b, arbFx, a)) + ' Gy' : '—';
  }

  validateInputs();

  // Save to history on valid calculation
  if (valid) {
    saveToHistory('bed', BED_INPUT_IDS);
    // bedSummary is defined in history.js — single source of truth so the
    // per-page history list and the hub's recents pill render identical text.
    renderHistory('bed', BED_INPUT_IDS, update, bedSummary);
  }
}

// Preset dropdown
var presetEl = document.getElementById('bed-preset');
if (presetEl) {
  presetEl.addEventListener('change', function () {
    var val = presetEl.value;
    if (!val) return;
    var parts = val.split(',');
    document.getElementById('bd-dose').value = parts[0];
    document.getElementById('bd-fx').value = parts[1];
    update();
  });
}

BED_INPUT_IDS.forEach(function (id) {
  document.getElementById(id).addEventListener('input', function () {
    // Reset preset to Custom when user manually edits
    if (presetEl) presetEl.value = '';
    update();
  });
});

// URL params + Copy Link
initUrlParams(BED_INPUT_IDS, update);
setupCopyLinkButton('copy-link-btn', BED_INPUT_IDS);

// Re-render when the global decimal-places preference changes
document.addEventListener('decimalschange', update);

// Initial render
update();
