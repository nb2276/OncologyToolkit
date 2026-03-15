// calcBED, calcEQD2, isoeffDose, fmt provided by math.js

function update() {
  const stDose = parseFloat(document.getElementById('st-dose').value);
  const stFx   = parseFloat(document.getElementById('st-fx').value);
  const stAb   = parseFloat(document.getElementById('st-ab').value);

  const pvDose = parseFloat(document.getElementById('pv-dose').value);
  const pvFx   = parseFloat(document.getElementById('pv-fx').value);
  const pvTdf  = parseFloat(document.getElementById('pv-tdf').value);

  const remFx  = parseFloat(document.getElementById('rem-fx').value);

  // Structure tolerance BED
  const stBedValid = !isNaN(stDose) && !isNaN(stFx) && !isNaN(stAb) && stDose > 0 && stFx >= 1 && stAb > 0;
  const stBed = stBedValid ? calcBED(stDose, stFx, stAb) : null;
  document.getElementById('st-bed').textContent = fmt(stBed);

  // Previous dose BED (uses same α/β as structure)
  const pvBedValid = stBedValid && !isNaN(pvDose) && !isNaN(pvFx) && !isNaN(pvTdf) &&
                     pvDose > 0 && pvFx >= 1 && pvTdf >= 0 && pvTdf <= 1;
  const pvBedRaw    = pvBedValid ? calcBED(pvDose, pvFx, stAb) : null;
  const pvBedAdj    = (pvBedRaw !== null) ? pvBedRaw * pvTdf : null;

  document.getElementById('pv-bed').textContent = fmt(pvBedRaw);
  const detailEl = document.getElementById('pv-bed-detail');
  if (pvBedRaw !== null && pvTdf !== 1) {
    detailEl.textContent = '× ' + fmt(pvTdf, 2) + ' = ' + fmt(pvBedAdj) + ' Gy (time-adjusted)';
  } else if (pvBedAdj !== null) {
    detailEl.textContent = '(no time discount)';
  } else {
    detailEl.textContent = '';
  }

  // Remaining dose calculation
  const eqEl     = document.getElementById('rem-eq');
  const resultEl = document.getElementById('rem-result');

  if (stBed === null || pvBedAdj === null) {
    eqEl.innerHTML = '—';
    resultEl.innerHTML = '';
    return;
  }

  const remBed = stBed - pvBedAdj;
  const adjLabel = pvTdf !== 1 ? 'time-adjusted ' : '';

  eqEl.innerHTML =
    '<strong>' + fmt(stBed) + ' Gy</strong> (tolerance BED) &minus; ' +
    '<strong>' + fmt(pvBedAdj) + ' Gy</strong> (' + adjLabel + 'previous BED) = ' +
    '<span class="' + (remBed >= 0 ? 'eq-result' : 'eq-warning') + '">' +
    fmt(remBed) + ' Gy remaining BED</span>';

  if (remBed <= 0) {
    resultEl.innerHTML =
      '<div class="comp-error-box">Previous dose exceeds or meets structure tolerance — no remaining dose available.</div>';
    return;
  }

  if (isNaN(remFx) || remFx < 1) {
    resultEl.innerHTML = '';
    return;
  }

  const remDose = isoeffDose(remBed, remFx, stAb);
  if (remDose === null || remDose <= 0) {
    resultEl.innerHTML =
      '<div class="comp-error-box">Unable to compute remaining dose for these parameters.</div>';
    return;
  }

  const dpf = remDose / remFx;
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
}

['st-dose', 'st-fx', 'st-ab', 'pv-dose', 'pv-fx', 'pv-tdf', 'rem-fx'].forEach(id => {
  document.getElementById(id).addEventListener('input', update);
});

update();
