// calcBED, calcEQD2, isoeffDose, fmt provided by math.js
// copyToClipboard provided by clipboard.js
// URL state + history provided by url-state.js, history.js

var COMP_INPUT_IDS = ['st-dose', 'st-fx', 'st-ab', 'pv-dose', 'pv-fx', 'pv-tdf', 'rem-fx'];

var COMP_RANGES = {
  'st-dose': { min: 0.1, max: 200, label: 'Typical: 1–80 Gy' },
  'st-fx':   { min: 1,   max: 60,  label: 'Typical: 1–45 fx' },
  'st-ab':   { min: 0.1, max: 30,  label: 'Typical: 1–20 Gy' },
  'pv-dose': { min: 0.1, max: 200, label: 'Typical: 1–80 Gy' },
  'pv-fx':   { min: 1,   max: 60,  label: 'Typical: 1–45 fx' },
  'pv-tdf':  { min: 0,   max: 1,   label: 'Range: 0–1' },
  'rem-fx':  { min: 1,   max: 60,  label: 'Typical: 1–45 fx' }
};

function validateInputs() {
  Object.keys(COMP_RANGES).forEach(function (id) {
    var el = document.getElementById(id);
    var warn = document.getElementById('warn-' + id);
    if (!el || !warn) return;
    var val = parseFloat(el.value);
    var r = COMP_RANGES[id];
    if (!isNaN(val) && (val < r.min || val > r.max)) {
      warn.textContent = r.label;
      warn.style.display = '';
    } else {
      warn.textContent = '';
      warn.style.display = 'none';
    }
  });
}

function update() {
  var stDose = parseFloat(document.getElementById('st-dose').value);
  var stFx   = parseFloat(document.getElementById('st-fx').value);
  var stAb   = parseFloat(document.getElementById('st-ab').value);

  var pvDose = parseFloat(document.getElementById('pv-dose').value);
  var pvFx   = parseFloat(document.getElementById('pv-fx').value);
  var pvTdf  = parseFloat(document.getElementById('pv-tdf').value);

  var remFx  = parseFloat(document.getElementById('rem-fx').value);

  // Structure tolerance BED
  var stBedValid = !isNaN(stDose) && !isNaN(stFx) && !isNaN(stAb) && stDose > 0 && stFx >= 1 && stAb > 0;
  var stBed = stBedValid ? calcBED(stDose, stFx, stAb) : null;
  document.getElementById('st-bed').textContent = fmt(stBed);

  // Previous dose BED (uses same α/β as structure)
  var pvBedValid = stBedValid && !isNaN(pvDose) && !isNaN(pvFx) && !isNaN(pvTdf) &&
                   pvDose > 0 && pvFx >= 1 && pvTdf >= 0 && pvTdf <= 1;
  var pvBedRaw    = pvBedValid ? calcBED(pvDose, pvFx, stAb) : null;
  var pvBedAdj    = (pvBedRaw !== null) ? pvBedRaw * pvTdf : null;

  document.getElementById('pv-bed').textContent = fmt(pvBedRaw);
  var detailEl = document.getElementById('pv-bed-detail');
  if (pvBedRaw !== null && pvTdf !== 1) {
    detailEl.textContent = '\u00d7 ' + fmt(pvTdf, 2) + ' = ' + fmt(pvBedAdj) + ' Gy (time-adjusted)';
  } else if (pvBedAdj !== null) {
    detailEl.textContent = '(no time discount)';
  } else {
    detailEl.textContent = '';
  }

  // Remaining dose calculation
  var eqEl     = document.getElementById('rem-eq');
  var resultEl = document.getElementById('rem-result');

  if (stBed === null || pvBedAdj === null) {
    eqEl.innerHTML = '—';
    resultEl.innerHTML = '';
    validateInputs();
    return;
  }

  var remBed = stBed - pvBedAdj;
  var adjLabel = pvTdf !== 1 ? 'time-adjusted ' : '';

  eqEl.innerHTML =
    '<strong>' + fmt(stBed) + ' Gy</strong> (tolerance BED) &minus; ' +
    '<strong>' + fmt(pvBedAdj) + ' Gy</strong> (' + adjLabel + 'previous BED) = ' +
    '<span class="' + (remBed >= 0 ? 'eq-result' : 'eq-warning') + '">' +
    fmt(remBed) + ' Gy remaining BED</span>';

  if (remBed <= 0) {
    resultEl.innerHTML =
      '<div class="comp-error-box">Previous dose exceeds or meets structure tolerance — no remaining dose available.</div>';
    validateInputs();
    return;
  }

  if (isNaN(remFx) || remFx < 1) {
    resultEl.innerHTML = '';
    validateInputs();
    return;
  }

  var remDose = isoeffDose(remBed, remFx, stAb);
  if (remDose === null || remDose <= 0) {
    resultEl.innerHTML =
      '<div class="comp-error-box">Unable to compute remaining dose for these parameters.</div>';
    validateInputs();
    return;
  }

  var dpf = remDose / remFx;
  resultEl.innerHTML =
    '<div class="comp-dose-box">' +
      '<div class="comp-dose-row">' +
        '<span class="comp-dose-label">Remaining dose</span>' +
        '<span class="comp-dose-val">' + fmt(remDose) + '</span>' +
        '<span class="comp-dose-unit">Gy</span>' +
      '</div>' +
      '<div class="comp-dose-sub">in ' + remFx + ' fractions &mdash; ' +
        '<span>' + fmt(dpf) + ' Gy / fraction</span>' +
      '</div>' +
    '</div>';

  validateInputs();

  // Save to history
  if (stBedValid && pvBedValid) {
    saveToHistory('composite', COMP_INPUT_IDS);
    renderHistory('composite', COMP_INPUT_IDS, update, function (params) {
      return 'Tol ' + (params['st-dose'] || '?') + 'Gy, Prior ' + (params['pv-dose'] || '?') + 'Gy';
    });
  }
}

COMP_INPUT_IDS.forEach(function (id) {
  document.getElementById(id).addEventListener('input', update);
});

// URL params + Copy Link
initUrlParams(COMP_INPUT_IDS, update);
setupCopyLinkButton('copy-link-btn', COMP_INPUT_IDS);

// Initial render
update();
