// ============================================================
// OAR data from UMich ReRT guidelines
// Report-only OARs (Body, PTV, Brain, Larynx, Musc_Constrict)
// are excluded per clinical preference.
// trf arrays correspond to the document time columns:
//   Serial:   [< 3 mo, 3–6 mo, 6 mo–1 yr, 1–3 yr]  +  > 3 yr → always 0.5
//   Parallel: [< 3 mo, 3–6 mo, 6 mo–2 yr, > 2 yr]
// ============================================================

const SERIAL_LABELS   = ['< 3 mo', '3–6 mo', '6 mo–1 yr', '1–3 yr', '> 3 yr'];
const PARALLEL_LABELS = ['< 3 mo', '3–6 mo', '6 mo–2 yr', '> 2 yr'];

const OAR_DATA = [
  // ---- Serial ----
  { id: 'bladder',     name: 'Bladder',                        group: 'serial',   constraint: 85,   trf: [0, 0.1, 0.25, 0.5]  },
  { id: 'bowel_small', name: 'Bowel_Small',                    group: 'serial',   constraint: 54,   trf: [0, 0,   0.25, 0.4]  },
  { id: 'brachial',    name: 'BrachialPlex',                   group: 'serial',   constraint: 70,   trf: [0, 0.1, 0.25, 0.5]  },
  { id: 'brainstem',   name: 'Brainstem',                      group: 'serial',   constraint: 64,   trf: [0, 0.1, 0.25, 0.5]  },
  { id: 'bronchus',    name: 'Bronchus',                       group: 'serial',   constraint: 70,   trf: [0, 0.1, 0.25, 0.5]  },
  { id: 'cauda',       name: 'CaudaEquina',                    group: 'serial',   constraint: 60,   trf: [0, 0.1, 0.25, 0.5]  },
  { id: 'cochlea',     name: 'Cochlea',                        group: 'serial',   constraint: 45,   trf: [0, 0.1, 0.25, 0.5]  },
  { id: 'colon',       name: 'Colon / Sigmoid / Bowel_Large',  group: 'serial',   constraint: 70,   trf: [0, 0.1, 0.25, 0.5]  },
  { id: 'duodenum',    name: 'Duodenum',                       group: 'serial',   constraint: 54,   trf: [0, 0,   0.25, 0.25] },
  { id: 'esophagus',   name: 'Esophagus',                      group: 'serial',   constraint: 70,   trf: [0, 0.1, 0.25, 0.5]  },
  { id: 'greatves',    name: 'GreatVes / Aorta',               group: 'serial',   constraint: 100,  trf: [0, 0.1, 0.25, 0.5]  },
  { id: 'heart',       name: 'Heart',                          group: 'serial',   constraint: 70,   trf: [0, 0.1, 0.25, 0.5]  },
  { id: 'kidneys',     name: 'Kidneys',                        group: 'serial',   constraint: null, constraintText: 'CV23 EQD2 ≥ 200 cc', trf: [0, 0, 0, 0] },
  { id: 'opticchiasm', name: 'OpticChiasm',                    group: 'serial',   constraint: 54,   trf: [0, 0.1, 0.25, 0.5]  },
  { id: 'opticnrv',    name: 'OpticNrv',                       group: 'serial',   constraint: 54,   trf: [0, 0.1, 0.25, 0.5]  },
  { id: 'rectum',      name: 'Rectum',                         group: 'serial',   constraint: 80,   trf: [0, 0.1, 0.25, 0.5]  },
  { id: 'retina',      name: 'Retina',                         group: 'serial',   constraint: 50,   trf: [0, 0.1, 0.25, 0.5]  },
  { id: 'sacralplex',  name: 'SacralPlex',                     group: 'serial',   constraint: 70,   trf: [0, 0.1, 0.25, 0.5]  },
  { id: 'spinalcord',  name: 'SpinalCord',                     group: 'serial',   constraint: 50,   trf: [0, 0.1, 0.25, 0.5]  },
  { id: 'spinalcord2', name: 'SpinalCord (< 2mm from target)', group: 'serial',   constraint: 55,   trf: [0, 0.1, 0.25, 0.5]  },
  { id: 'stomach',     name: 'Stomach',                        group: 'serial',   constraint: 54,   trf: [0, 0,   0.25, 0.4]  },
  { id: 'trachea',     name: 'Trachea',                        group: 'serial',   constraint: 70,   trf: [0, 0.1, 0.25, 0.5]  },
  // ---- Parallel ----
  { id: 'lungs',  name: 'Lungs-GTV / Lungs-ITV', group: 'parallel', constraint: null, unit: 'cc', constraintCc: 1000, constraintText: 'V16 EQD2 (cc) ≥ 1000', doseLabel: 'Prior V16 volume (cc)', trf: [0, 0, 0.25, 0.5] },
  { id: 'liver',  name: 'Liver',                group: 'parallel', constraint: null, unit: 'cc', constraintCc: 700,  constraintText: 'V32 EQD2 (cc) ≥ 700',  doseLabel: 'Prior V32 volume (cc)', trf: [0, 0, 0.5,  1]   },
];

const oarById    = Object.fromEntries(OAR_DATA.map(o => [o.id, o]));
const addedOarIds = [];

// ============================================================
// TRF helpers
// ============================================================

function getActiveTrfIdx(oar, months) {
  if (oar.group === 'serial') {
    if (months < 3)  return 0;
    if (months < 6)  return 1;
    if (months < 12) return 2;
    if (months < 36) return 3;
    return 4; // > 3 yr — always 0.5 per document
  } else {
    if (months < 3)  return 0;
    if (months < 6)  return 1;
    if (months < 24) return 2;
    return 3;
  }
}

function getActiveTrf(oar, months) {
  const idx = getActiveTrfIdx(oar, months);
  if (oar.group === 'serial' && idx === 4) return 0.5;
  return oar.trf[idx];
}

function getTimeBucketLabel(months) {
  if (months < 3)  return '< 3 months';
  if (months < 6)  return '3 – 6 months';
  if (months < 12) return '6 months – 1 year';
  if (months < 24) return '1 – 2 years';
  if (months < 36) return '2 – 3 years';
  return '> 3 years';
}

// calcBED, calcEQD2, isoeffDose, fmt provided by math.js

// Aliases for readability in reirradiation context
function physicalToEqd2(D, n, ab) { return calcEQD2(D, n, ab); }

function eqd2ToPhysical(eqd2, n, ab) {
  if (eqd2 <= 0 || n < 1 || ab <= 0) return null;
  var bed = eqd2 * (2 + ab) / ab;
  return isoeffDose(bed, n, ab);
}

// ============================================================
// DOM helpers
// ============================================================

const $ = id => document.getElementById(id);

// ============================================================
// Build checkbox list
// ============================================================

function buildCheckboxList() {
  const container = $('oar-check-list');

  function renderGroup(label, oars) {
    const hdr = document.createElement('span');
    hdr.className = 'rert-check-group-label';
    hdr.textContent = label;
    container.appendChild(hdr);

    oars.forEach(oar => {
      const item = document.createElement('label');
      item.className = 'rert-check-item';
      item.htmlFor = 'check-' + oar.id;
      item.innerHTML =
        '<input type="checkbox" id="check-' + oar.id + '" value="' + oar.id + '">' +
        oar.name;
      item.querySelector('input').addEventListener('change', function () {
        onCheckboxChange(oar.id, this.checked);
      });
      container.appendChild(item);
    });
  }

  renderGroup('Serial OARs',   OAR_DATA.filter(o => o.group === 'serial'));
  renderGroup('Parallel OARs', OAR_DATA.filter(o => o.group === 'parallel'));
}

// ============================================================
// Add / remove OAR (driven by checkbox state)
// ============================================================

function updateOarCount() {
  const el = $('oar-count');
  if (!el) return;
  const n = addedOarIds.length;
  el.textContent = n === 0 ? 'none selected' : n + ' selected';
  el.classList.toggle('has-selection', n > 0);
}

function onCheckboxChange(id, checked) {
  if (checked && !addedOarIds.includes(id)) {
    addedOarIds.push(id);
    const oar = oarById[id];
    $('oar-list').appendChild(buildOarCard(oar));
    const tr = document.createElement('tr');
    tr.id = 'rert-row-' + id;
    $('rert-tbody').appendChild(tr);
    $('dose-' + id).addEventListener('input', updateAll);
    toggleEmptyRow();
    updateOarCount();
    updateBtnBar();
    updateAll();
  } else if (!checked && addedOarIds.includes(id)) {
    addedOarIds.splice(addedOarIds.indexOf(id), 1);
    const card = $('oar-card-' + id);
    if (card) card.remove();
    const row = $('rert-row-' + id);
    if (row) row.remove();
    toggleEmptyRow();
    updateOarCount();
    updateBtnBar();
  }
}

function removeOar(id) {
  // Uncheck the checkbox, which triggers onCheckboxChange
  const cb = $('check-' + id);
  if (cb && cb.checked) {
    cb.checked = false;
    onCheckboxChange(id, false);
  }
}

// ============================================================
// Build an OAR card for the left panel
// ============================================================

function buildOarCard(oar) {
  const labels  = oar.group === 'serial' ? SERIAL_LABELS : PARALLEL_LABELS;
  const trfVals = oar.group === 'serial' ? [...oar.trf, 0.5] : [...oar.trf];

  const constraintLabel = oar.constraintText || (oar.constraint + ' Gy EQD2');

  const chips = labels.map((lbl, i) =>
    '<div class="rert-trf-chip" id="trf-chip-' + oar.id + '-' + i + '">' +
      '<span class="rert-trf-val">' + trfVals[i] + '</span>' +
      '<span class="rert-trf-lbl">' + lbl + '</span>' +
    '</div>'
  ).join('');

  const card = document.createElement('div');
  card.className = 'bed-card rert-oar-card';
  card.id = 'oar-card-' + oar.id;
  card.innerHTML =
    '<div class="rert-oar-header">' +
      '<span class="rert-oar-name">' + oar.name + '</span>' +
      '<span class="rert-constraint-badge">' + constraintLabel + '</span>' +
      '<button class="rert-remove-btn" onclick="removeOar(\'' + oar.id + '\')" title="Remove">&times;</button>' +
    '</div>' +
    '<div class="rert-oar-dose-row">' +
      '<label>' + (oar.doseLabel || 'Prior Dose (Gy)') + '</label>' +
      '<input type="number" class="bed-num-input rert-dose-input"' +
             ' id="dose-' + oar.id + '" placeholder="0.0" min="0" step="0.1">' +
      '<span class="rert-eqd2-display" id="eqd2disp-' + oar.id + '"></span>' +
    '</div>' +
    '<div class="rert-trf-row">' + chips + '</div>';
  return card;
}

// ============================================================
// Toggle "add OARs" placeholder row
// ============================================================

function toggleEmptyRow() {
  const row = $('rert-empty-row');
  if (row) row.style.display = addedOarIds.length === 0 ? '' : 'none';
}

// ============================================================
// Row-building helpers
// ============================================================

function buildNameCell(name, subtext, subClass) {
  return '<td class="bed-row-label">' + name +
         '<span class="' + subClass + '">' + subtext + '</span></td>';
}

function buildDataCells(remVal, fxVals, cellClass) {
  return [
    '<td class="' + cellClass + '">' + remVal + '</td>',
    '<td class="' + cellClass + ' col-1fx">' + (fxVals[0] || '—') + '</td>',
    '<td class="' + cellClass + ' col-3fx">' + (fxVals[1] || '—') + '</td>',
    '<td class="' + cellClass + ' col-5fx">' + (fxVals[2] || '—') + '</td>',
    '<td class="' + cellClass + ' col-cfx">' + (fxVals[3] || '—') + '</td>',
  ];
}

function renderResultRow(row, name, sub, subClass, remVal, fxVals, cellClass, titleAttr) {
  var nameHtml = buildNameCell(name, sub, subClass);
  var dataCells = buildDataCells(remVal, fxVals, cellClass);
  if (titleAttr) dataCells[0] = dataCells[0].replace('class="', 'title="' + titleAttr + '" class="');
  row.innerHTML = nameHtml + dataCells.join('');
}

// ============================================================
// Main update
// ============================================================

function updateAll() {
  const prFx   = parseFloat($('pr-fx').value);
  const prAb   = parseFloat($('pr-ab').value);
  const prMo   = parseFloat($('pr-mo').value);
  const custFx = parseFloat($('custom-fx').value);

  // Time bucket label
  const timeLabelEl = $('time-label');
  if (timeLabelEl) {
    const span = timeLabelEl.querySelector('span');
    if (span) span.textContent = (!isNaN(prMo) && prMo >= 0) ? getTimeBucketLabel(prMo) : '—';
  }

  const planValid = !isNaN(prFx) && prFx >= 1 && !isNaN(prAb) && prAb > 0;
  const timeValid = !isNaN(prMo) && prMo >= 0;
  const custOk    = !isNaN(custFx) && custFx >= 1;

  addedOarIds.forEach(id => {
    const oar  = oarById[id];
    const dose = parseFloat($('dose-' + id).value);
    const hasDose = !isNaN(dose) && dose > 0;

    // TRF chip highlights
    const numChips  = oar.group === 'serial' ? 5 : 4;
    const activeIdx = timeValid ? getActiveTrfIdx(oar, prMo) : -1;
    for (let i = 0; i < numChips; i++) {
      const chip = $('trf-chip-' + id + '-' + i);
      if (chip) chip.classList.toggle('active', i === activeIdx);
    }

    // CC-based volumetric OARs (Lungs, Liver)
    if (oar.unit === 'cc') {
      const trfCc = timeValid ? getActiveTrf(oar, prMo) : 0;
      let effVol = null;
      let remCc  = null;
      if (hasDose) {
        effVol = dose * (1 - trfCc);
        $('eqd2disp-' + id).textContent = '\u2192 effective: ' + effVol.toFixed(1) + ' cc';
        remCc = oar.constraintCc - effVol;
      } else {
        $('eqd2disp-' + id).textContent = '';
      }
      const row = $('rert-row-' + id);
      if (!row) return;
      const sub = oar.constraintText;
      const exceeded = remCc !== null && remCc <= 0;
      if (exceeded) {
        renderResultRow(row, oar.name, sub, 'rert-oar-subtext',
          remCc.toFixed(1) + ' cc \u26a0', [], 'rert-exceeded', 'Volume constraint exceeded');
      } else {
        renderResultRow(row, oar.name, sub, 'rert-oar-subtext',
          remCc !== null ? remCc.toFixed(1) + ' cc' : '—', [], 'rert-report');
      }
      return;
    }

    // EQD2 of prior dose
    let eqd2Prior = null;
    if (planValid && hasDose) {
      eqd2Prior = physicalToEqd2(dose, prFx, prAb);
      $('eqd2disp-' + id).textContent = '\u2192 EQD2: ' + fmt(eqd2Prior) + ' Gy';
    } else {
      $('eqd2disp-' + id).textContent = '';
    }

    // Remaining EQD2
    const trf   = timeValid ? getActiveTrf(oar, prMo) : 0;
    let remEqd2 = null;
    if (eqd2Prior !== null && oar.constraint !== null) {
      remEqd2 = oar.constraint - eqd2Prior * (1 - trf);
    }

    const row = $('rert-row-' + id);
    if (!row) return;

    const noConstraint = oar.constraint === null;
    const exceeded     = remEqd2 !== null && remEqd2 <= 0;

    if (noConstraint) {
      const effPrior = eqd2Prior !== null ? eqd2Prior * (1 - trf) : null;
      renderResultRow(row, oar.name, 'no numeric constraint', 'rert-report-only-note',
        fmt(effPrior) + '<span class="rert-report-only-note">eff. prior EQD2</span>',
        [], 'rert-report', 'Time-discounted effective prior EQD2');
    } else if (exceeded) {
      const sub = oar.constraintText || ('\u2264 ' + oar.constraint + ' Gy EQD2');
      renderResultRow(row, oar.name, sub, 'rert-oar-subtext',
        fmt(remEqd2) + ' \u26a0', [], 'rert-exceeded', 'Prior dose exceeds or meets constraint');
    } else {
      const d1 = remEqd2 !== null ? eqd2ToPhysical(remEqd2, 1,      prAb) : null;
      const d3 = remEqd2 !== null ? eqd2ToPhysical(remEqd2, 3,      prAb) : null;
      const d5 = remEqd2 !== null ? eqd2ToPhysical(remEqd2, 5,      prAb) : null;
      const dN = (remEqd2 !== null && custOk) ? eqd2ToPhysical(remEqd2, custFx, prAb) : null;
      const sub = oar.constraintText || ('\u2264 ' + oar.constraint + ' Gy EQD2');
      renderResultRow(row, oar.name, sub, 'rert-oar-subtext',
        fmt(remEqd2), [fmt(d1), fmt(d3), fmt(d5), fmt(dN)], 'bed-result-cell');
    }
  });

  applyColumnVisibility();
}

// ============================================================
// Column visibility
// ============================================================

function toggleColumn() {
  applyColumnVisibility();
}

function applyColumnVisibility() {
  ['col-1fx', 'col-3fx', 'col-5fx', 'col-cfx'].forEach(cls => {
    const checked = $(cls).checked;
    document.querySelectorAll('.' + cls).forEach(el => {
      el.style.display = checked ? '' : 'none';
    });
  });
}

// ============================================================
// Button bar visibility
// ============================================================

function updateBtnBar() {
  const bar = $('rert-btn-bar');
  if (bar) bar.style.display = addedOarIds.length > 0 ? '' : 'none';
}

// ============================================================
// Build report text (prior treatment + OAR table)
// ============================================================

function buildReportText() {
  const prFx = $('pr-fx').value;
  const prAb = $('pr-ab').value;
  const prMo = $('pr-mo').value;
  const custFx = $('custom-fx').value;

  let text = 'Reirradiation Dose Report\n';
  text += '========================\n\n';
  text += 'Prior Treatment\n';
  text += '  Fractions: ' + prFx + '\n';
  text += '  \u03b1/\u03b2: ' + prAb + ' Gy\n';
  text += '  Months since prior RT: ' + prMo + '\n';
  text += '  Time bucket: ' + getTimeBucketLabel(parseFloat(prMo)) + '\n\n';

  // OAR doses
  text += 'OAR Doses\n';
  addedOarIds.forEach(id => {
    const oar = oarById[id];
    const dose = $('dose-' + id).value;
    const eqd2 = $('eqd2disp-' + id).textContent;
    text += '  ' + oar.name + ': ' + (dose || '—') + (oar.unit === 'cc' ? ' cc' : ' Gy') +
            (eqd2 ? '  ' + eqd2 : '') + '\n';
  });

  // Results table
  text += '\nRemaining Dose Constraints\n';

  const show1 = $('col-1fx').checked;
  const show3 = $('col-3fx').checked;
  const show5 = $('col-5fx').checked;
  const showC = $('col-cfx').checked;

  // Header
  let hdr = 'OAR'.padEnd(38) + 'Rem. EQD2';
  if (show1) hdr += '   1 fx';
  if (show3) hdr += '   3 fx';
  if (show5) hdr += '   5 fx';
  if (showC) hdr += '   ' + custFx + ' fx';
  text += hdr + '\n';
  text += '-'.repeat(hdr.length) + '\n';

  const rows = $('rert-tbody').querySelectorAll('tr:not(#rert-empty-row)');
  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length < 2) return;
    let line = (cells[0].textContent.split('\n')[0]).trim().padEnd(38);
    line += (cells[1].textContent || '').trim().padStart(9);
    if (show1 && cells[2]) line += (cells[2].textContent || '').trim().padStart(7);
    if (show3 && cells[3]) line += (cells[3].textContent || '').trim().padStart(7);
    if (show5 && cells[4]) line += (cells[4].textContent || '').trim().padStart(7);
    if (showC && cells[5]) line += (cells[5].textContent || '').trim().padStart(7);
    text += line + '\n';
  });

  return text;
}

// ============================================================
// Copy results
// ============================================================

function copyRertResults() {
  const text = buildReportText();
  const btn = $('rert-copy-btn');
  navigator.clipboard.writeText(text).then(function() {
    const orig = btn.textContent;
    btn.textContent = '\u2713 Copied!';
    setTimeout(function() { btn.textContent = orig; }, 1500);
  }).catch(function() {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    const orig = btn.textContent;
    btn.textContent = '\u2713 Copied!';
    setTimeout(function() { btn.textContent = orig; }, 1500);
  });
}

// ============================================================
// Print
// ============================================================

function printRertResults() {
  const printWin = window.open('', '_blank');
  printWin.document.write(buildPrintHtml());
  printWin.document.close();
  printWin.focus();
  printWin.print();
}

// ============================================================
// Shared print HTML builder
// ============================================================

function buildPrintHtml() {
  const prFx = $('pr-fx').value;
  const prAb = $('pr-ab').value;
  const prMo = $('pr-mo').value;
  const custFx = $('custom-fx').value;

  const show1 = $('col-1fx').checked;
  const show3 = $('col-3fx').checked;
  const show5 = $('col-5fx').checked;
  const showC = $('col-cfx').checked;

  let html = '<!DOCTYPE html><html><head><meta charset="UTF-8">';
  html += '<title>Reirradiation Dose Report</title>';
  html += '<style>';
  html += 'body{font-family:"DM Sans",system-ui,sans-serif;margin:32px;color:#222;font-size:13px;}';
  html += 'h2{margin:0 0 4px;font-size:18px;}';
  html += '.meta{color:#555;margin-bottom:18px;font-size:12px;}';
  html += 'h3{font-size:14px;margin:18px 0 6px;border-bottom:1px solid #ccc;padding-bottom:4px;}';
  html += 'table{border-collapse:collapse;width:100%;margin-bottom:16px;}';
  html += 'th,td{border:1px solid #ccc;padding:5px 8px;text-align:left;font-size:12px;}';
  html += 'th{background:#f0f0f0;font-weight:600;}';
  html += 'td.num{text-align:right;}';
  html += '.exceeded{color:#c62828;font-weight:600;}';
  html += '.sub{display:block;font-size:10px;color:#777;font-weight:normal;}';
  html += '.footer{margin-top:24px;font-size:11px;color:#888;border-top:1px solid #ddd;padding-top:8px;}';
  html += '@media print{body{margin:16px;}}';
  html += '</style></head><body>';

  html += '<h2>Reirradiation Dose Report</h2>';
  html += '<div class="meta">oncologytoolkit.com &mdash; Generated ' + new Date().toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'}) + '</div>';

  // Prior treatment
  html += '<h3>Prior Treatment</h3>';
  html += '<table><tr><th>Fractions</th><th>\u03b1/\u03b2 (Gy)</th><th>Months Since RT</th><th>Time Bucket</th></tr>';
  html += '<tr><td>' + prFx + '</td><td>' + prAb + '</td><td>' + prMo + '</td>';
  html += '<td>' + getTimeBucketLabel(parseFloat(prMo)) + '</td></tr></table>';

  // OAR doses
  html += '<h3>OAR Prior Doses</h3>';
  html += '<table><tr><th>OAR</th><th>Prior Dose</th><th>EQD2 / Effective</th></tr>';
  addedOarIds.forEach(id => {
    const oar = oarById[id];
    const dose = $('dose-' + id).value || '—';
    const eqd2 = $('eqd2disp-' + id).textContent || '—';
    const unit = oar.unit === 'cc' ? ' cc' : ' Gy';
    html += '<tr><td>' + oar.name + '</td><td class="num">' + dose + unit + '</td><td>' + eqd2 + '</td></tr>';
  });
  html += '</table>';

  // Results
  html += '<h3>Remaining Dose Constraints</h3>';
  html += '<table><tr><th>OAR</th><th>Rem. EQD2 (Gy)</th>';
  if (show1) html += '<th>1 fx (Gy)</th>';
  if (show3) html += '<th>3 fx (Gy)</th>';
  if (show5) html += '<th>5 fx (Gy)</th>';
  if (showC) html += '<th>' + custFx + ' fx (Gy)</th>';
  html += '</tr>';

  const rows = $('rert-tbody').querySelectorAll('tr:not(#rert-empty-row)');
  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length < 2) return;
    const isExceeded = cells[1].classList.contains('rert-exceeded');
    const cls = isExceeded ? ' class="exceeded"' : ' class="num"';
    const nameText = cells[0].querySelector('.rert-oar-subtext, .rert-report-only-note');
    const sub = nameText ? '<span class="sub">' + nameText.textContent + '</span>' : '';
    const name = cells[0].childNodes[0].textContent.trim();
    html += '<tr><td>' + name + sub + '</td>';
    html += '<td' + cls + '>' + cells[1].textContent.trim() + '</td>';
    if (show1 && cells[2]) html += '<td' + cls + '>' + cells[2].textContent.trim() + '</td>';
    if (show3 && cells[3]) html += '<td' + cls + '>' + cells[3].textContent.trim() + '</td>';
    if (show5 && cells[4]) html += '<td' + cls + '>' + cells[4].textContent.trim() + '</td>';
    if (showC && cells[5]) html += '<td' + cls + '>' + cells[5].textContent.trim() + '</td>';
    html += '</tr>';
  });
  html += '</table>';

  html += '<div class="footer">This report is for educational purposes only and is not a substitute for professional medical advice.</div>';
  html += '</body></html>';
  return html;
}

// ============================================================
// Init
// ============================================================

buildCheckboxList();

['pr-fx', 'pr-ab', 'pr-mo', 'custom-fx'].forEach(id => {
  $(id).addEventListener('input', updateAll);
});

toggleEmptyRow();
updateAll();
