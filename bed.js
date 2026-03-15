// calcBED, calcEQD2, isoeffDose, fmt provided by math.js

function update() {
  const D  = parseFloat(document.getElementById('bd-dose').value);
  const n  = parseFloat(document.getElementById('bd-fx').value);
  const ab = [
    parseFloat(document.getElementById('ab1').value),
    parseFloat(document.getElementById('ab2').value),
    parseFloat(document.getElementById('ab3').value),
  ];

  // Reflect current α/β values in the alternative fractionation header
  for (let i = 0; i < 3; i++) {
    const el = document.getElementById('ab' + (i + 1) + '-disp');
    if (el) el.textContent = isNaN(ab[i]) ? '?' : ab[i];
  }

  // Dose per fraction display
  const dpfEl = document.getElementById('dpf-val');
  if (dpfEl) {
    dpfEl.textContent = (D > 0 && n >= 1) ? (D / n).toFixed(2) : '—';
  }

  const valid = !isNaN(D) && !isNaN(n) && D > 0 && n >= 1 && ab.every(a => !isNaN(a) && a > 0);
  const beds = valid ? ab.map(a => calcBED(D, n, a))  : [null, null, null];
  const eqds = valid ? ab.map(a => calcEQD2(D, n, a)) : [null, null, null];

  for (let i = 0; i < 3; i++) {
    document.getElementById('bed' + (i + 1)).textContent = fmt(beds[i]);
    document.getElementById('eqd' + (i + 1)).textContent = fmt(eqds[i]);
  }

  const arbFx = parseFloat(document.getElementById('arb-fx').value);
  const arbOk = !isNaN(arbFx) && arbFx >= 1;

  for (let i = 0; i < 3; i++) {
    const b = beds[i];
    const a = ab[i];
    const goodBed = b !== null && !isNaN(a) && a > 0;

    document.getElementById('alt1-' + (i + 1)).textContent =
      goodBed ? fmt(isoeffDose(b, 1, a)) + ' Gy' : '—';
    document.getElementById('alt3-' + (i + 1)).textContent =
      goodBed ? fmt(isoeffDose(b, 3, a)) + ' Gy' : '—';
    document.getElementById('alt5-' + (i + 1)).textContent =
      goodBed ? fmt(isoeffDose(b, 5, a)) + ' Gy' : '—';
    document.getElementById('altA-' + (i + 1)).textContent =
      (goodBed && arbOk) ? fmt(isoeffDose(b, arbFx, a)) + ' Gy' : '—';
  }
}

['bd-dose', 'bd-fx', 'ab1', 'ab2', 'ab3', 'arb-fx'].forEach(id => {
  document.getElementById(id).addEventListener('input', update);
});

update();
