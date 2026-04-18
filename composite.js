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
      warn.style.display = 'block';
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
  var eqEl      = document.getElementById('rem-eq');
  var resultEl  = document.getElementById('rem-result');
  var tableWrap = document.getElementById('rem-table-wrap');
  var defaultFx = [1, 3, 5, 10];

  function clearRemTable() {
    defaultFx.forEach(function (n) {
      document.getElementById('rem-dose-' + n).textContent = '—';
      document.getElementById('rem-dpf-' + n).textContent = '—';
    });
    document.getElementById('rem-dose-custom').textContent = '—';
    document.getElementById('rem-dpf-custom').textContent = '—';
  }

  if (stBed === null || pvBedAdj === null) {
    eqEl.innerHTML = '—';
    resultEl.innerHTML = '';
    tableWrap.style.display = 'none';
    clearRemTable();
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
    tableWrap.style.display = 'none';
    clearRemTable();
    validateInputs();
    return;
  }

  resultEl.innerHTML = '';
  tableWrap.style.display = 'block';

  // Fill default fraction rows
  defaultFx.forEach(function (n) {
    var dose = isoeffDose(remBed, n, stAb);
    if (dose !== null && dose > 0) {
      document.getElementById('rem-dose-' + n).textContent = fmt(dose);
      document.getElementById('rem-dpf-' + n).textContent = fmt(dose / n);
    } else {
      document.getElementById('rem-dose-' + n).textContent = '—';
      document.getElementById('rem-dpf-' + n).textContent = '—';
    }
  });

  // Fill custom fraction row
  if (!isNaN(remFx) && remFx >= 1) {
    var customDose = isoeffDose(remBed, remFx, stAb);
    if (customDose !== null && customDose > 0) {
      document.getElementById('rem-dose-custom').textContent = fmt(customDose);
      document.getElementById('rem-dpf-custom').textContent = fmt(customDose / remFx);
    } else {
      document.getElementById('rem-dose-custom').textContent = '—';
      document.getElementById('rem-dpf-custom').textContent = '—';
    }
  } else {
    document.getElementById('rem-dose-custom').textContent = '—';
    document.getElementById('rem-dpf-custom').textContent = '—';
  }

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

// Re-render when the global decimal-places preference changes
document.addEventListener('decimalschange', update);

// Initial render
update();
