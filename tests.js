// ============================================================
// OncologyToolkit Test Suite
// Run: node tests.js
// No dependencies required.
// ============================================================

'use strict';

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(message);
    console.log('  FAIL: ' + message);
  }
}

function assertClose(actual, expected, tolerance, message) {
  const ok = Math.abs(actual - expected) < tolerance;
  if (ok) {
    passed++;
  } else {
    failed++;
    const detail = message + ' (expected ' + expected + ', got ' + actual + ')';
    failures.push(detail);
    console.log('  FAIL: ' + detail);
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    const detail = message + ' (expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual) + ')';
    failures.push(detail);
    console.log('  FAIL: ' + detail);
  }
}

function section(name) {
  console.log('\n' + name);
}

// ============================================================
// Load source files by evaluating them in a controlled context
// ============================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const dir = __dirname;

function loadFile(filename) {
  return fs.readFileSync(path.join(dir, filename), 'utf-8');
}

// Create a shared sandbox with DOM stubs
function makeDomElement() {
  return {
    className: '', id: '', innerHTML: '', textContent: '', htmlFor: '',
    style: { display: '' },
    checked: false,
    value: '',
    children: [],
    appendChild: function(child) { this.children.push(child); return child; },
    querySelector: function() { return makeDomElement(); },
    querySelectorAll: function() { return []; },
    addEventListener: function() {},
    classList: { toggle: function() {}, add: function() {}, remove: function() {}, contains: function() { return false; } },
    remove: function() {}
  };
}

var sandbox = {
  console: console,
  Math: Math,
  Date: Date,
  Set: Set,
  Array: Array,
  Object: Object,
  parseFloat: parseFloat,
  parseInt: parseInt,
  isNaN: isNaN,
  isFinite: isFinite,
  NaN: NaN,
  Infinity: Infinity,
  undefined: undefined,
  JSON: JSON,
  setTimeout: setTimeout,
  Promise: Promise,
  document: {
    getElementById: function() { return makeDomElement(); },
    createElement: function() { return makeDomElement(); },
    querySelector: function() { return makeDomElement(); },
    querySelectorAll: function() { return []; },
    addEventListener: function() {},
    body: { appendChild: function() {} }
  },
  window: {
    addEventListener: function() {},
    open: function() {},
    location: { search: '', pathname: '/bed.html', origin: 'http://localhost' },
    history: { replaceState: function() {} }
  },
  URLSearchParams: URLSearchParams,
  localStorage: (function() {
    var store = {};
    return {
      getItem: function(k) { return store.hasOwnProperty(k) ? store[k] : null; },
      setItem: function(k, v) { store[k] = String(v); },
      removeItem: function(k) { delete store[k]; },
      clear: function() { store = {}; },
      _store: store
    };
  })(),
  navigator: { clipboard: { write: function() { return Promise.resolve(); }, writeText: function() { return Promise.resolve(); } } },
  Chart: { helpers: { getRelativePosition: function() {} }, defaults: { plugins: { legend: { onClick: function() {} } } } },
  ClipboardItem: function() {}
};

vm.createContext(sandbox);

// Load clipboard.js — uses function declarations
vm.runInContext(loadFile('clipboard.js'), sandbox);

// Load url-state.js — uses function declarations
vm.runInContext(loadFile('url-state.js'), sandbox);

// Load history.js — uses var/function declarations
vm.runInContext(loadFile('history.js'), sandbox);

// Load math.js — uses var/function declarations so they go on sandbox global
vm.runInContext(loadFile('math.js'), sandbox);

// Load validate.js — must precede rert.js (rert.js calls applyRangeWarning)
vm.runInContext(loadFile('validate.js'), sandbox);

// Load rert.js — uses const, so we wrap to export via globalThis
var rertSource = loadFile('rert.js');
vm.runInContext(`
  ${rertSource}
  globalThis.OAR_DATA = OAR_DATA;
  globalThis.getActiveTrfIdx = getActiveTrfIdx;
  globalThis.getActiveTrf = getActiveTrf;
  globalThis.getTimeBucketLabel = getTimeBucketLabel;
  globalThis.physicalToEqd2 = physicalToEqd2;
  globalThis.eqd2ToPhysical = eqd2ToPhysical;
  globalThis.SERIAL_LABELS = SERIAL_LABELS;
  globalThis.PARALLEL_LABELS = PARALLEL_LABELS;
  globalThis.RERT_RANGES = RERT_RANGES;
  globalThis.OAR_DOSE_RANGE_GY = OAR_DOSE_RANGE_GY;
  globalThis.OAR_DOSE_RANGE_CC = OAR_DOSE_RANGE_CC;
`, sandbox);

// Load psa.js — strip 'use strict', wrap to export
var psaSource = loadFile('psa.js').replace(/^'use strict';\s*/, '');
vm.runInContext(`
  ${psaSource}
  globalThis.tryParseDate = tryParseDate;
  globalThis.makeDate = makeDate;
  globalThis.parseLine = parseLine;
  globalThis.parseInput = parseInput;
  globalThis.dedupeMeasurements = dedupeMeasurements;
  globalThis.fitExponential = fitExponential;
  globalThis.doublingTimeCI = doublingTimeCI;
  globalThis.psaVelocity = psaVelocity;
  globalThis.tValue95 = tValue95;
  globalThis.fmtDoublingTime = fmtDoublingTime;
  globalThis.fmtDoublingTimeCI = fmtDoublingTimeCI;
  globalThis.fmtPsa = fmtPsa;
  globalThis.fmtPsaCell = fmtPsaCell;
  globalThis.fmtVelocity = fmtVelocity;
  globalThis.updateParsedTable = updateParsedTable;
  globalThis.lastFittedDateMs = lastFittedDateMs;
  globalThis.fittablePoints = fittablePoints;
  globalThis.recentWindow = recentWindow;
  globalThis.compareTrend = compareTrend;
  globalThis.noiseCaveat = noiseCaveat;
  globalThis.medianOf = medianOf;
  globalThis.psaShortDt = psaShortDt;
`, sandbox);

// Extract functions from sandbox
var fmt = sandbox.fmt;
var calcBED = sandbox.calcBED;
var calcEQD2 = sandbox.calcEQD2;
var isoeffDose = sandbox.isoeffDose;
var physicalToEqd2 = sandbox.physicalToEqd2;
var eqd2ToPhysical = sandbox.eqd2ToPhysical;
var getActiveTrfIdx = sandbox.getActiveTrfIdx;
var getActiveTrf = sandbox.getActiveTrf;
var getTimeBucketLabel = sandbox.getTimeBucketLabel;
var OAR_DATA = sandbox.OAR_DATA;
var tryParseDate = sandbox.tryParseDate;
var makeDate = sandbox.makeDate;
var parseLine = sandbox.parseLine;
var parseInput = sandbox.parseInput;
var dedupeMeasurements = sandbox.dedupeMeasurements;
var fitExponential = sandbox.fitExponential;
var doublingTimeCI = sandbox.doublingTimeCI;
var psaVelocity = sandbox.psaVelocity;
var tValue95 = sandbox.tValue95;
var fmtDoublingTime = sandbox.fmtDoublingTime;
var fmtDoublingTimeCI = sandbox.fmtDoublingTimeCI;
var fmtPsa = sandbox.fmtPsa;
var fmtPsaCell = sandbox.fmtPsaCell;
var fmtVelocity = sandbox.fmtVelocity;
var updateParsedTable = sandbox.updateParsedTable;
var lastFittedDateMs = sandbox.lastFittedDateMs;
var fittablePoints = sandbox.fittablePoints;
var recentWindow = sandbox.recentWindow;
var compareTrend = sandbox.compareTrend;
var noiseCaveat = sandbox.noiseCaveat;
var medianOf = sandbox.medianOf;
var psaShortDt = sandbox.psaShortDt;
var parseUrlParams = sandbox.parseUrlParams;
var serializeToUrl = sandbox.serializeToUrl;
var buildToolUrl = sandbox.buildToolUrl;
var saveToHistory = sandbox.saveToHistory;
var loadHistory = sandbox.loadHistory;
var clearHistory = sandbox.clearHistory;
var getRecentAcrossTools = sandbox.getRecentAcrossTools;
var bedSummary = sandbox.bedSummary;
var compositeSummary = sandbox.compositeSummary;
var rertSummary = sandbox.rertSummary;
var psaSummary = sandbox.psaSummary;
var relativeTime = sandbox.relativeTime;
var trimNum = sandbox.trimNum;
var copyToClipboard = sandbox.copyToClipboard;
var HISTORY_MAX = sandbox.HISTORY_MAX;
var classifyRange = sandbox.classifyRange;
var applyRangeWarning = sandbox.applyRangeWarning;
var RERT_RANGES = sandbox.RERT_RANGES;
var OAR_DOSE_RANGE_GY = sandbox.OAR_DOSE_RANGE_GY;
var OAR_DOSE_RANGE_CC = sandbox.OAR_DOSE_RANGE_CC;


// ============================================================
// TESTS: math.js — BED/EQD2/isoeffDose/fmt
// ============================================================

section('=== math.js: fmt ===');

assertEqual(fmt(null), '—', 'fmt(null) returns dash');
assertEqual(fmt(undefined), '—', 'fmt(undefined) returns dash');
assertEqual(fmt(NaN), '—', 'fmt(NaN) returns dash');
assertEqual(fmt(Infinity), '—', 'fmt(Infinity) returns dash');
assertEqual(fmt(-Infinity), '—', 'fmt(-Infinity) returns dash');
assertEqual(fmt(1.234), '1.23', 'fmt rounds to 2 decimals by default');
assertEqual(fmt(1.235), '1.24', 'fmt rounds up at .5');
assertEqual(fmt(0), '0.00', 'fmt(0) returns 0.00');
assertEqual(fmt(100), '100.00', 'fmt(100) returns 100.00');
assertEqual(fmt(1.23456, 4), '1.2346', 'fmt with custom decimals');
assertEqual(fmt(1.5, 0), '2', 'fmt with 0 decimals');

section('=== math.js: calcBED ===');

// BED = D * (1 + d/ab) where d = D/n
// 55 Gy in 20 fx, ab=10: d=2.75, BED = 55*(1+2.75/10) = 55*1.275 = 70.125
assertClose(calcBED(55, 20, 10), 70.125, 0.001, 'BED: 55Gy/20fx ab=10');

// 55 Gy in 20 fx, ab=3: BED = 55*(1+2.75/3) = 55*1.9167 = 105.417
assertClose(calcBED(55, 20, 3), 105.4167, 0.01, 'BED: 55Gy/20fx ab=3');

// 55 Gy in 20 fx, ab=2: BED = 55*(1+2.75/2) = 55*2.375 = 130.625
assertClose(calcBED(55, 20, 2), 130.625, 0.001, 'BED: 55Gy/20fx ab=2');

// Single fraction SBRT: 20 Gy in 1 fx, ab=10: BED = 20*(1+20/10) = 60
assertClose(calcBED(20, 1, 10), 60, 0.001, 'BED: 20Gy/1fx ab=10 (SBRT)');

// Standard 2 Gy/fx: 60 Gy in 30 fx, ab=10: BED = 60*(1+2/10) = 72
assertClose(calcBED(60, 30, 10), 72, 0.001, 'BED: 60Gy/30fx ab=10');

section('=== math.js: calcEQD2 ===');

// EQD2 = D * (d + ab) / (2 + ab) where d = D/n
// 55 Gy in 20 fx, ab=10: d=2.75, EQD2 = 55*(2.75+10)/(2+10) = 55*12.75/12 = 58.4375
assertClose(calcEQD2(55, 20, 10), 58.4375, 0.001, 'EQD2: 55Gy/20fx ab=10');

// 60 Gy in 30 fx (2 Gy/fx), ab=10: EQD2 = 60*(2+10)/(2+10) = 60
assertClose(calcEQD2(60, 30, 10), 60, 0.001, 'EQD2: 60Gy/30fx ab=10 (identity at 2Gy/fx)');

// 20 Gy in 5 fx, ab=3: d=4, EQD2 = 20*(4+3)/(2+3) = 20*7/5 = 28
assertClose(calcEQD2(20, 5, 3), 28, 0.001, 'EQD2: 20Gy/5fx ab=3');

// 50 Gy in 25 fx (2 Gy/fx), ab=3: EQD2 = 50 (identity)
assertClose(calcEQD2(50, 25, 3), 50, 0.001, 'EQD2: 50Gy/25fx ab=3 (identity at 2Gy/fx)');

section('=== math.js: isoeffDose ===');

// Round-trip: calcBED then isoeffDose should recover original dose
var bed1 = calcBED(55, 20, 10);
assertClose(isoeffDose(bed1, 20, 10), 55, 0.001, 'isoeffDose round-trip: 55Gy/20fx ab=10');

var bed2 = calcBED(60, 30, 3);
assertClose(isoeffDose(bed2, 30, 3), 60, 0.001, 'isoeffDose round-trip: 60Gy/30fx ab=3');

// Convert BED to single fraction
var bed3 = calcBED(50, 25, 10);  // BED = 50*(1+2/10) = 60
// 1 fx: BED = d*(1+d/10), 60 = d + d²/10, d² + 10d - 600 = 0
// d = (-10 + sqrt(100+2400))/2 = (-10 + 50)/2 = 20
assertClose(isoeffDose(bed3, 1, 10), 20, 0.001, 'isoeffDose: BED 60 in 1fx ab=10 = 20Gy');

// Edge cases
assertEqual(isoeffDose(-10, 5, 10), null, 'isoeffDose: negative BED returns null');
assertEqual(isoeffDose(0, 5, 10), 0, 'isoeffDose: zero BED returns 0');

section('=== rert.js: physicalToEqd2 ===');

// Should match calcEQD2
assertClose(physicalToEqd2(55, 20, 10), calcEQD2(55, 20, 10), 0.001, 'physicalToEqd2 matches calcEQD2');
assertClose(physicalToEqd2(20, 5, 3), calcEQD2(20, 5, 3), 0.001, 'physicalToEqd2 matches calcEQD2 (2)');

section('=== rert.js: eqd2ToPhysical ===');

// Round-trip: physicalToEqd2 then eqd2ToPhysical
var eqd2_1 = physicalToEqd2(45, 25, 2.5);
assertClose(eqd2ToPhysical(eqd2_1, 25, 2.5), 45, 0.001, 'eqd2ToPhysical round-trip: 45Gy/25fx ab=2.5');

var eqd2_2 = physicalToEqd2(30, 10, 3);
assertClose(eqd2ToPhysical(eqd2_2, 10, 3), 30, 0.001, 'eqd2ToPhysical round-trip: 30Gy/10fx ab=3');

// Edge cases
assertEqual(eqd2ToPhysical(0, 5, 3), null, 'eqd2ToPhysical: zero eqd2 returns null');
assertEqual(eqd2ToPhysical(-5, 5, 3), null, 'eqd2ToPhysical: negative eqd2 returns null');
assertEqual(eqd2ToPhysical(50, 0, 3), null, 'eqd2ToPhysical: zero fractions returns null');
assertEqual(eqd2ToPhysical(50, 5, 0), null, 'eqd2ToPhysical: zero ab returns null');

// ============================================================
// TESTS: rert.js — TRF bucket logic
// ============================================================

section('=== rert.js: getActiveTrfIdx (serial) ===');

var serialOar = OAR_DATA.find(function(o) { return o.id === 'spinalcord'; });

assertEqual(getActiveTrfIdx(serialOar, 0), 0, 'serial: 0 months → idx 0 (< 3 mo)');
assertEqual(getActiveTrfIdx(serialOar, 2), 0, 'serial: 2 months → idx 0 (< 3 mo)');
assertEqual(getActiveTrfIdx(serialOar, 2.99), 0, 'serial: 2.99 months → idx 0 (< 3 mo)');
assertEqual(getActiveTrfIdx(serialOar, 3), 1, 'serial: 3 months → idx 1 (3-6 mo)');
assertEqual(getActiveTrfIdx(serialOar, 5), 1, 'serial: 5 months → idx 1 (3-6 mo)');
assertEqual(getActiveTrfIdx(serialOar, 5.99), 1, 'serial: 5.99 months → idx 1 (3-6 mo)');
assertEqual(getActiveTrfIdx(serialOar, 6), 2, 'serial: 6 months → idx 2 (6mo-1yr)');
assertEqual(getActiveTrfIdx(serialOar, 11), 2, 'serial: 11 months → idx 2 (6mo-1yr)');
assertEqual(getActiveTrfIdx(serialOar, 11.99), 2, 'serial: 11.99 months → idx 2 (6mo-1yr)');
assertEqual(getActiveTrfIdx(serialOar, 12), 3, 'serial: 12 months → idx 3 (1-3yr)');
assertEqual(getActiveTrfIdx(serialOar, 24), 3, 'serial: 24 months → idx 3 (1-3yr)');
assertEqual(getActiveTrfIdx(serialOar, 35), 3, 'serial: 35 months → idx 3 (1-3yr)');
assertEqual(getActiveTrfIdx(serialOar, 35.99), 3, 'serial: 35.99 months → idx 3 (1-3yr)');
assertEqual(getActiveTrfIdx(serialOar, 36), 4, 'serial: 36 months → idx 4 (> 3yr)');
assertEqual(getActiveTrfIdx(serialOar, 60), 4, 'serial: 60 months → idx 4 (> 3yr)');

section('=== rert.js: getActiveTrfIdx (parallel) ===');

var parallelOar = OAR_DATA.find(function(o) { return o.id === 'lungs'; });

assertEqual(getActiveTrfIdx(parallelOar, 0), 0, 'parallel: 0 months → idx 0');
assertEqual(getActiveTrfIdx(parallelOar, 2.99), 0, 'parallel: 2.99 months → idx 0');
assertEqual(getActiveTrfIdx(parallelOar, 3), 1, 'parallel: 3 months → idx 1');
assertEqual(getActiveTrfIdx(parallelOar, 5.99), 1, 'parallel: 5.99 months → idx 1');
assertEqual(getActiveTrfIdx(parallelOar, 6), 2, 'parallel: 6 months → idx 2 (6mo-2yr)');
assertEqual(getActiveTrfIdx(parallelOar, 23), 2, 'parallel: 23 months → idx 2 (6mo-2yr)');
assertEqual(getActiveTrfIdx(parallelOar, 23.99), 2, 'parallel: 23.99 months → idx 2 (6mo-2yr)');
assertEqual(getActiveTrfIdx(parallelOar, 24), 3, 'parallel: 24 months → idx 3 (> 2yr)');
assertEqual(getActiveTrfIdx(parallelOar, 60), 3, 'parallel: 60 months → idx 3 (> 2yr)');

section('=== rert.js: getActiveTrf ===');

// SpinalCord trf: [0, 0.1, 0.25, 0.5], > 3yr → 0.5
assertEqual(getActiveTrf(serialOar, 0), 0, 'serial TRF: 0 months → 0');
assertEqual(getActiveTrf(serialOar, 4), 0.1, 'serial TRF: 4 months → 0.1');
assertEqual(getActiveTrf(serialOar, 8), 0.25, 'serial TRF: 8 months → 0.25');
assertEqual(getActiveTrf(serialOar, 18), 0.5, 'serial TRF: 18 months → 0.5');
assertEqual(getActiveTrf(serialOar, 40), 0.5, 'serial TRF: 40 months → 0.5 (> 3yr)');

// Lungs trf: [0, 0, 0.25, 0.5]
assertEqual(getActiveTrf(parallelOar, 1), 0, 'parallel TRF: 1 month → 0');
assertEqual(getActiveTrf(parallelOar, 4), 0, 'parallel TRF: 4 months → 0');
assertEqual(getActiveTrf(parallelOar, 12), 0.25, 'parallel TRF: 12 months → 0.25');
assertEqual(getActiveTrf(parallelOar, 30), 0.5, 'parallel TRF: 30 months → 0.5');

// Duodenum has different TRF: [0, 0, 0.25, 0.25]
var duodenum = OAR_DATA.find(function(o) { return o.id === 'duodenum'; });
assertEqual(getActiveTrf(duodenum, 18), 0.25, 'duodenum TRF: 18 months → 0.25');
assertEqual(getActiveTrf(duodenum, 40), 0.5, 'duodenum TRF: 40 months → 0.5 (> 3yr hardcoded)');

section('=== rert.js: getTimeBucketLabel ===');

assertEqual(getTimeBucketLabel(0), '< 3 months', 'bucket: 0 months');
assertEqual(getTimeBucketLabel(2), '< 3 months', 'bucket: 2 months');
assertEqual(getTimeBucketLabel(3), '3 – 6 months', 'bucket: 3 months');
assertEqual(getTimeBucketLabel(5), '3 – 6 months', 'bucket: 5 months');
assertEqual(getTimeBucketLabel(6), '6 months – 1 year', 'bucket: 6 months');
assertEqual(getTimeBucketLabel(11), '6 months – 1 year', 'bucket: 11 months');
assertEqual(getTimeBucketLabel(12), '1 – 2 years', 'bucket: 12 months');
assertEqual(getTimeBucketLabel(23), '1 – 2 years', 'bucket: 23 months');
assertEqual(getTimeBucketLabel(24), '2 – 3 years', 'bucket: 24 months');
assertEqual(getTimeBucketLabel(35), '2 – 3 years', 'bucket: 35 months');
assertEqual(getTimeBucketLabel(36), '> 3 years', 'bucket: 36 months');
assertEqual(getTimeBucketLabel(100), '> 3 years', 'bucket: 100 months');

// ============================================================
// TESTS: rert.js — OAR_DATA integrity
// ============================================================

section('=== rert.js: OAR_DATA integrity ===');

assert(OAR_DATA.length === 24, 'OAR_DATA has 24 entries');

var serialOars = OAR_DATA.filter(function(o) { return o.group === 'serial'; });
var parallelOars = OAR_DATA.filter(function(o) { return o.group === 'parallel'; });
assert(serialOars.length === 22, '22 serial OARs');
assert(parallelOars.length === 2, '2 parallel OARs');

// All serial OARs have 4-element trf arrays
serialOars.forEach(function(oar) {
  assert(oar.trf.length === 4, 'serial OAR ' + oar.id + ' has 4 TRF values');
});

// All parallel OARs have 4-element trf arrays
parallelOars.forEach(function(oar) {
  assert(oar.trf.length === 4, 'parallel OAR ' + oar.id + ' has 4 TRF values');
});

// All OARs have unique IDs
var ids = OAR_DATA.map(function(o) { return o.id; });
var uniqueIds = new Set(ids);
assert(uniqueIds.size === ids.length, 'All OAR IDs are unique');

// Constraints are non-negative or null
OAR_DATA.forEach(function(oar) {
  if (oar.constraint !== null) {
    assert(oar.constraint > 0, 'OAR ' + oar.id + ' has positive constraint');
  }
});

// ============================================================
// TESTS: psa.js — Date parsing
// ============================================================

section('=== psa.js: tryParseDate ===');

// ISO format: YYYY-MM-DD
var d1 = tryParseDate('2024-06-15');
assert(d1 !== null, 'ISO: 2024-06-15 parses');
assertEqual(d1.getFullYear(), 2024, 'ISO: year 2024');
assertEqual(d1.getMonth(), 5, 'ISO: month June (5)');
assertEqual(d1.getDate(), 15, 'ISO: day 15');

// US format: MM/DD/YYYY
var d2 = tryParseDate('01/15/2023');
assert(d2 !== null, 'US: 01/15/2023 parses');
assertEqual(d2.getFullYear(), 2023, 'US: year 2023');
assertEqual(d2.getMonth(), 0, 'US: month Jan (0)');
assertEqual(d2.getDate(), 15, 'US: day 15');

// EU format when first part > 12: DD/MM/YYYY
var d3 = tryParseDate('15/01/2025');
assert(d3 !== null, 'EU: 15/01/2025 parses');
assertEqual(d3.getFullYear(), 2025, 'EU: year 2025');
assertEqual(d3.getMonth(), 0, 'EU: month Jan (0)');
assertEqual(d3.getDate(), 15, 'EU: day 15');

// Dot separator: DD.MM.YYYY (p1=15 > 12 → DD-first)
var d4 = tryParseDate('15.01.2025');
assert(d4 !== null, 'dot: 15.01.2025 parses');
assertEqual(d4.getFullYear(), 2025, 'dot: year 2025');
assertEqual(d4.getMonth(), 0, 'dot: month Jan (0)');
assertEqual(d4.getDate(), 15, 'dot: day 15');

// 2-digit year: MM/DD/YY
var d5 = tryParseDate('04/11/22');
assert(d5 !== null, '2-digit year: 04/11/22 parses');
assertEqual(d5.getFullYear(), 2022, '2-digit year: year 2022');
assertEqual(d5.getMonth(), 3, '2-digit year: month April (3)');
assertEqual(d5.getDate(), 11, '2-digit year: day 11');

// Dot separator with US convention: MM.DD.YYYY (p1 <= 12, ambiguous → US)
var d6 = tryParseDate('06.20.2023');
assert(d6 !== null, 'dot US: 06.20.2023 parses');
assertEqual(d6.getFullYear(), 2023, 'dot US: year 2023');
assertEqual(d6.getMonth(), 5, 'dot US: month June (5)');
assertEqual(d6.getDate(), 20, 'dot US: day 20');

// Invalid dates
assertEqual(tryParseDate('2024-13-01'), null, 'invalid month 13 returns null');
assertEqual(tryParseDate('2024-02-30'), null, 'Feb 30 returns null (rollover caught)');
assertEqual(tryParseDate('not-a-date'), null, 'non-date string returns null');
assertEqual(tryParseDate(''), null, 'empty string returns null');

// YYYY format with year > 31
var d7 = tryParseDate('2023-01-05');
assert(d7 !== null, 'YYYY-MM-DD: 2023-01-05');
assertEqual(d7.getFullYear(), 2023, 'YYYY-MM-DD year');
assertEqual(d7.getMonth(), 0, 'YYYY-MM-DD month Jan');
assertEqual(d7.getDate(), 5, 'YYYY-MM-DD day 5');

section('=== psa.js: makeDate ===');

// Valid date
var md1 = makeDate(2024, 6, 15);
assert(md1 !== null, 'makeDate: valid date');

// Invalid month
assertEqual(makeDate(2024, 0, 15), null, 'makeDate: month 0 invalid');
assertEqual(makeDate(2024, 13, 15), null, 'makeDate: month 13 invalid');

// Invalid day
assertEqual(makeDate(2024, 1, 0), null, 'makeDate: day 0 invalid');
assertEqual(makeDate(2024, 1, 32), null, 'makeDate: day 32 invalid');

// Feb 29 in leap year
var md2 = makeDate(2024, 2, 29);
assert(md2 !== null, 'makeDate: Feb 29 2024 (leap year) valid');

// Feb 29 in non-leap year
assertEqual(makeDate(2023, 2, 29), null, 'makeDate: Feb 29 2023 (non-leap) invalid');

// Year bounds
assertEqual(makeDate(1899, 1, 1), null, 'makeDate: year 1899 invalid');
assertEqual(makeDate(2101, 1, 1), null, 'makeDate: year 2101 invalid');

section('=== psa.js: parseLine ===');

// Standard format: date then PSA
var pl1 = parseLine('01/15/2023 1.20');
assert(pl1 !== null, 'parseLine: standard format parses');
assertClose(pl1.psaValue, 1.20, 0.001, 'parseLine: PSA value 1.20');

// With "PSA" label
var pl2 = parseLine('06.20.2023, PSA 2.4');
assert(pl2 !== null, 'parseLine: with PSA label parses');
assertClose(pl2.psaValue, 2.4, 0.001, 'parseLine: PSA value 2.4');

// With colon separators and PSA: label
var pl3 = parseLine('04/11/22: PSA: 0.08');
assert(pl3 !== null, 'parseLine: colon format parses');
assertClose(pl3.psaValue, 0.08, 0.001, 'parseLine: PSA value 0.08');

// ISO date with comma
var pl4 = parseLine('2024-06-15, 9.1');
assert(pl4 !== null, 'parseLine: ISO with comma parses');
assertClose(pl4.psaValue, 9.1, 0.001, 'parseLine: PSA value 9.1');

// Comment line
assertEqual(parseLine('# this is a comment'), null, 'parseLine: comment line returns null');

// Empty line
assertEqual(parseLine(''), null, 'parseLine: empty line returns null');
assertEqual(parseLine('   '), null, 'parseLine: whitespace line returns null');

// No PSA value
assertEqual(parseLine('01/15/2023'), null, 'parseLine: no PSA value returns null');

// No valid date
assertEqual(parseLine('hello 1.5'), null, 'parseLine: no valid date returns null');

section('=== psa.js: parseInput ===');

var input = '01/15/2023 1.20\n06/20/2023 2.40\n2024-06-15 9.1';
var parsed = parseInput(input);
assertEqual(parsed.length, 3, 'parseInput: 3 measurements parsed');
assert(parsed[0].date < parsed[1].date, 'parseInput: sorted chronologically (0 < 1)');
assert(parsed[1].date < parsed[2].date, 'parseInput: sorted chronologically (1 < 2)');

// Handles blank lines
var input2 = '\n01/15/2023 1.20\n\n06/20/2023 2.40\n\n';
var parsed2 = parseInput(input2);
assertEqual(parsed2.length, 2, 'parseInput: ignores blank lines');

section('=== psa.js: dedupeMeasurements ===');

// Exact duplicate (same date AND same value) → collapsed to one
var dupSet = [
  { date: new Date(2023, 0, 1), psaValue: 1.2 },
  { date: new Date(2023, 0, 1), psaValue: 1.2 },
  { date: new Date(2023, 5, 1), psaValue: 2.0 },
];
var deduped = dedupeMeasurements(dupSet);
assertEqual(deduped.length, 2, 'dedupeMeasurements: exact duplicate removed');
assertClose(deduped[0].psaValue, 1.2, 0.001, 'dedupeMeasurements: keeps first occurrence value');

// Same date, DIFFERENT value → both kept (not duplicates)
var sameDayDiff = [
  { date: new Date(2023, 0, 1), psaValue: 1.2 },
  { date: new Date(2023, 0, 1), psaValue: 1.4 },
];
assertEqual(dedupeMeasurements(sameDayDiff).length, 2, 'dedupeMeasurements: same-day different values both kept');

// Same value, DIFFERENT date → both kept
var sameValDiffDate = [
  { date: new Date(2023, 0, 1), psaValue: 2.0 },
  { date: new Date(2023, 6, 1), psaValue: 2.0 },
];
assertEqual(dedupeMeasurements(sameValDiffDate).length, 2, 'dedupeMeasurements: same value different dates both kept');

// No duplicates → unchanged
assertEqual(dedupeMeasurements(sameValDiffDate).length, sameValDiffDate.length, 'dedupeMeasurements: no-op when no duplicates');
// Empty
assertEqual(dedupeMeasurements([]).length, 0, 'dedupeMeasurements: empty input');

// ============================================================
// TESTS: psa.js — Exponential fit
// ============================================================

section('=== psa.js: fitExponential ===');

// Create known exponential data: y = 2 * exp(0.01 * x)
// At x=0, y=2; at x=69.3 (ln2/0.01), y=4 → doubling time = 69.3 days
var fitData = [
  { date: new Date(2023, 0, 1), psaValue: 2.0 },
  { date: new Date(2023, 1, 1), psaValue: 2.0 * Math.exp(0.01 * 31) },
  { date: new Date(2023, 2, 1), psaValue: 2.0 * Math.exp(0.01 * 59) },
  { date: new Date(2023, 3, 1), psaValue: 2.0 * Math.exp(0.01 * 90) },
];
var fit = fitExponential(fitData);
assert(fit !== null, 'fitExponential: returns non-null for valid data');
assertClose(fit.A, 2.0, 0.1, 'fitExponential: A close to 2.0');
assertClose(fit.B, 0.01, 0.001, 'fitExponential: B close to 0.01');
assertClose(fit.doublingTimeDays, Math.log(2) / 0.01, 1, 'fitExponential: doubling time ~69.3 days');

// Less than 2 points
assertEqual(fitExponential([{ date: new Date(), psaValue: 1.0 }]), null, 'fitExponential: < 2 points returns null');
assertEqual(fitExponential([]), null, 'fitExponential: empty array returns null');

// Zero PSA values should be filtered
var fitWithZero = [
  { date: new Date(2023, 0, 1), psaValue: 0 },
  { date: new Date(2023, 1, 1), psaValue: 2.0 },
  { date: new Date(2023, 2, 1), psaValue: 4.0 },
];
var fitZ = fitExponential(fitWithZero);
assert(fitZ !== null, 'fitExponential: filters zero PSA, still fits with 2 remaining');
assertEqual(fitZ.pts.length, 2, 'fitExponential: 2 valid points after filtering zeros');

// Variance info available for n >= 3
var fit3 = fitExponential([
  { date: new Date(2023, 0, 1), psaValue: 1.0 },
  { date: new Date(2023, 3, 1), psaValue: 2.0 },
  { date: new Date(2023, 6, 1), psaValue: 4.0 },
]);
assert(fit3 !== null, 'fitExponential: 3 points works');
assert(fit3.varLnA !== undefined, 'fitExponential: varLnA present for n=3');
assert(fit3.varB !== undefined, 'fitExponential: varB present for n=3');
assert(fit3.covAB !== undefined, 'fitExponential: covAB present for n=3');
assert(fit3.n === 3, 'fitExponential: n = 3');

// ---- Unweighted fit: noisy data pins the OLS slope (weighted w=y² would differ) ----
// Reference computed from the unweighted log-linear regression on this set.
var noisyData = [
  { date: new Date(2023, 0, 1),  psaValue: 1.0 },
  { date: new Date(2023, 2, 1),  psaValue: 2.2 },
  { date: new Date(2023, 5, 1),  psaValue: 1.8 },
  { date: new Date(2023, 8, 1),  psaValue: 4.5 },
  { date: new Date(2023, 11, 1), psaValue: 6.0 },
];
var noisyFit = fitExponential(noisyData);
assertClose(noisyFit.B, 0.00498336, 1e-6, 'fitExponential: unweighted slope on noisy data (pins OLS, not w=y²)');
assertClose(noisyFit.doublingTimeDays, 139.0922, 0.01, 'fitExponential: noisy doubling time ~139.1 days');
assert(noisyFit.rSquaredDefined === true, 'fitExponential: R² defined for n≥3 with spread');
assertClose(noisyFit.rSquared, 0.874116, 1e-4, 'fitExponential: log-scale R² ~0.874');

// R² ~ 1 for exact-exponential data
assertClose(fit.rSquared, 1.0, 1e-4, 'fitExponential: R² ≈ 1 for exact exponential');

// n=2: fit returns, but CI/R² are flagged not-estimable (no fake zero-width CI)
var twoPt = fitExponential([
  { date: new Date(2023, 0, 1), psaValue: 1.0 },
  { date: new Date(2023, 6, 1), psaValue: 2.0 },
]);
assert(twoPt !== null, 'fitExponential: 2 points returns a fit');
assert(twoPt.ciEstimable === false, 'fitExponential: n=2 → ciEstimable false (no fake CI)');
assert(twoPt.rSquaredDefined === false, 'fitExponential: n=2 → R² not defined');

// Constant PSA: zero log-spread → R² undefined, not 0/0 NaN
var constFit = fitExponential([
  { date: new Date(2023, 0, 1), psaValue: 5 },
  { date: new Date(2023, 3, 1), psaValue: 5 },
  { date: new Date(2023, 6, 1), psaValue: 5 },
]);
assert(constFit.rSquaredDefined === false, 'fitExponential: constant PSA → R² undefined (no NaN)');
assert(constFit.rSquared === null, 'fitExponential: constant PSA → rSquared null');
// Constant PSA → B≈0 → doubling time is infinite/absurd; headline must not leak it.
assert(!isFinite(constFit.doublingTimeDays) || Math.abs(constFit.doublingTimeDays) > 100 * 365.25,
  'fitExponential: constant PSA → doubling time is infinite/beyond-lifetime');

// parseLine rejects non-finite PSA (1e309 → Infinity)
assertEqual(parseLine('2023-01-01 1e309'), null, 'parseLine: Infinity-valued PSA rejected');
assertEqual(parseLine('2023-01-01 Infinity'), null, 'parseLine: literal Infinity rejected');

section('=== psa.js: doublingTimeCI ===');

// Normal increasing series → finite, ordered interval bracketing the estimate
var ciNoisy = doublingTimeCI(noisyFit);
assert(ciNoisy.estimable === true, 'doublingTimeCI: estimable for clean increasing trend');
assert(ciNoisy.increasing === true, 'doublingTimeCI: increasing flag set');
assertClose(ciNoisy.loDays, 81.9552, 0.01, 'doublingTimeCI: lower bound ~82 days');
assertClose(ciNoisy.hiDays, 459.3131, 0.01, 'doublingTimeCI: upper bound ~459 days');
assert(ciNoisy.loDays < noisyFit.doublingTimeDays && noisyFit.doublingTimeDays < ciNoisy.hiDays,
  'doublingTimeCI: point estimate lies inside the interval');

// n=2 → not estimable (needs ≥3)
assert(doublingTimeCI(twoPt).estimable === false, 'doublingTimeCI: n=2 not estimable');
assertEqual(doublingTimeCI(twoPt).reason, 'need3', 'doublingTimeCI: n=2 reason=need3');

// Slope CI that straddles zero → not estimable (unbounded interval), NOT Infinity
// Near-flat noisy data so the slope CI spans zero.
var flatFit = fitExponential([
  { date: new Date(2023, 0, 1),  psaValue: 2.0 },
  { date: new Date(2023, 3, 1),  psaValue: 2.1 },
  { date: new Date(2023, 6, 1),  psaValue: 1.9 },
  { date: new Date(2023, 9, 1),  psaValue: 2.05 },
]);
var ciFlat = doublingTimeCI(flatFit);
assert(ciFlat.estimable === false, 'doublingTimeCI: flat trend (slope CI spans 0) not estimable');
assertEqual(ciFlat.reason, 'spanszero', 'doublingTimeCI: spans-zero reason set');

// Clean decreasing series → both bounds negative (halving), still estimable
var decFit = fitExponential([
  { date: new Date(2023, 0, 1), psaValue: 8 },
  { date: new Date(2023, 2, 1), psaValue: 4 },
  { date: new Date(2023, 4, 1), psaValue: 2 },
  { date: new Date(2023, 6, 1), psaValue: 1 },
]);
var ciDec = doublingTimeCI(decFit);
assert(ciDec.estimable === true, 'doublingTimeCI: clean decreasing series is estimable');
assert(ciDec.increasing === false, 'doublingTimeCI: decreasing flag (halving)');
assert(ciDec.loDays < 0 && ciDec.hiDays < 0, 'doublingTimeCI: decreasing → both bounds negative');
// The decreasing CI must render as positive, ordered halving times (no leading "-")
var decLabel = fmtDoublingTimeCI(ciDec);
assert(decLabel.indexOf('halving') !== -1, 'fmtDoublingTimeCI: decreasing labelled halving');
assert(decLabel.indexOf('-') === -1, 'fmtDoublingTimeCI: decreasing shows positive magnitudes (no minus sign)');
// Spans-zero + n<3 messaging
assert(fmtDoublingTimeCI({ estimable: false, reason: 'spanszero' }).indexOf('not estimable') !== -1,
  'fmtDoublingTimeCI: spans-zero message');
assert(fmtDoublingTimeCI({ estimable: false, reason: 'need3' }).indexOf('≥3') !== -1,
  'fmtDoublingTimeCI: need-3 message');

// psaShortDt (history/hub label) must collapse stable/non-finite to "stable", not "Infinity yr"
assertEqual(psaShortDt(Infinity), 'stable', 'psaShortDt: Infinity → stable');
assertEqual(psaShortDt(100 * 365.25 + 1), 'stable', 'psaShortDt: beyond-lifetime → stable');
assertEqual(psaShortDt(-30), 'decreasing', 'psaShortDt: negative → decreasing');

section('=== psa.js: psaVelocity ===');

assertClose(psaVelocity(noisyData), 5.300128, 1e-4, 'psaVelocity: linear slope ng/mL/yr on noisy data');
assertEqual(psaVelocity([{ date: new Date(2023, 0, 1), psaValue: 1 }]), null, 'psaVelocity: <2 points returns null');
assertEqual(psaVelocity([]), null, 'psaVelocity: empty returns null');
// Zeros excluded → same as filtered set
var velZeros = psaVelocity([
  { date: new Date(2023, 0, 1), psaValue: 0 },
  { date: new Date(2023, 2, 1), psaValue: 2.2 },
  { date: new Date(2023, 5, 1), psaValue: 1.8 },
  { date: new Date(2023, 8, 1), psaValue: 4.5 },
  { date: new Date(2023, 11, 1), psaValue: 6.0 },
]);
var velNoFirst = psaVelocity(noisyData.slice(1));
assertClose(velZeros, velNoFirst, 1e-9, 'psaVelocity: PSA≤0 excluded (matches filtered set)');

section('=== psa.js: tValue95 ===');

// Known values
assertClose(tValue95(1), 12.706, 0.01, 'tValue95: df=1 → 12.706');
assertClose(tValue95(2), 4.303, 0.01, 'tValue95: df=2 → 4.303');
assertClose(tValue95(10), 2.228, 0.01, 'tValue95: df=10 → 2.228');
assertClose(tValue95(1000), 1.96, 0.03, 'tValue95: df=1000 → ~1.96 (interpolated)');
assertClose(tValue95(0), 12.706, 0.01, 'tValue95: df=0 → 12.706');

section('=== psa.js: fmtDoublingTime ===');

// Days
assert(fmtDoublingTime(30).includes('30.0 days'), 'fmtDoublingTime: 30 days');

// Months
assert(fmtDoublingTime(90).includes('months'), 'fmtDoublingTime: 90 days shows months');

// Years
assert(fmtDoublingTime(800).includes('years'), 'fmtDoublingTime: 800 days shows years');
assert(fmtDoublingTime(800).includes('months'), 'fmtDoublingTime: 800 days also shows months');

// Negative (decreasing PSA)
assert(fmtDoublingTime(-50).includes('decreasing'), 'fmtDoublingTime: negative shows decreasing');

// Stable / non-finite guards — must never leak "Infinity" or "NaN" to the UI
assert(!/Infinity/.test(fmtDoublingTime(Infinity)), 'fmtDoublingTime: Infinity → no "Infinity" text');
assert(fmtDoublingTime(Infinity).toLowerCase().includes('stable'), 'fmtDoublingTime: Infinity → "stable"');
assert(!/NaN/.test(fmtDoublingTime(NaN)), 'fmtDoublingTime: NaN → no "NaN" text');
assert(fmtDoublingTime(100 * 365.25 + 1).toLowerCase().includes('stable'), 'fmtDoublingTime: >100yr → stable');

section('=== psa.js: fmtPsa (ultrasensitive values) ===');

// Ordinary values keep the familiar 2-decimal display
assertEqual(fmtPsa(4.5), '4.50', 'fmtPsa: 4.5 → 4.50');
assertEqual(fmtPsa(18.72), '18.72', 'fmtPsa: 18.72 → 18.72');
assertEqual(fmtPsa(0.1), '0.10', 'fmtPsa: 0.1 (threshold) → 0.10');
assertEqual(fmtPsa(1234.5), '1234.50', 'fmtPsa: large value keeps 2 decimals');

// Ultrasensitive (<0.1) must not collapse to 0.00
assertEqual(fmtPsa(0.001), '0.001', 'fmtPsa: 0.001 → 0.001 (not 0.00)');
assertEqual(fmtPsa(0.014), '0.014', 'fmtPsa: 0.014 → 0.014');
assertEqual(fmtPsa(0.05), '0.050', 'fmtPsa: 0.05 → 0.050');
assertEqual(fmtPsa(0.0996), '0.100', 'fmtPsa: rounds within the 3-decimal band');
assertEqual(fmtPsa(0.0004), '0.00040', 'fmtPsa: <0.001 falls back to 2 sig figs');
assertEqual(fmtPsa(-0.008), '-0.008', 'fmtPsa: negative small value keeps precision');

// Guards
assertEqual(fmtPsa(0), '0.00', 'fmtPsa: exact zero → 0.00');
assert(!/NaN|Infinity/.test(fmtPsa(NaN)), 'fmtPsa: NaN → no "NaN" text');
assert(!/NaN|Infinity/.test(fmtPsa(Infinity)), 'fmtPsa: Infinity → no "Infinity" text');
assert(!/NaN|Infinity/.test(fmtPsa(null)), 'fmtPsa: null → no "NaN" text');

// Velocity shares the same precision rule (an ultrasensitive rise is sub-0.1)
assert(fmtVelocity(0.004).includes('+0.004'), 'fmtVelocity: tiny rise keeps 3 decimals');
assert(fmtVelocity(5.3).includes('+5.30'), 'fmtVelocity: ordinary rise keeps 2 decimals');
assert(fmtVelocity(-0.02).includes('-0.020'), 'fmtVelocity: small decline keeps 3 decimals');
assertEqual(fmtVelocity(null), 'velocity n/a', 'fmtVelocity: null → n/a');

// Parsing + fitting ultrasensitive data end-to-end
var ultraLine = parseLine('2024-03-01, PSA 0.008');
assert(ultraLine !== null, 'parseLine: ultrasensitive line parses');
assertClose(ultraLine.psaValue, 0.008, 1e-9, 'parseLine: 0.008 preserved');
var ultraFit = fitExponential([
  { date: new Date(2024, 0, 1), psaValue: 0.010 },
  { date: new Date(2024, 6, 1), psaValue: 0.020 },
  { date: new Date(2025, 0, 1), psaValue: 0.040 },
]);
assert(ultraFit !== null, 'fitExponential: ultrasensitive series fits');
assertClose(ultraFit.doublingTimeDays, 183, 1.5, 'fitExponential: 0.01→0.02→0.04 doubles ~every 6 mo');

section('=== psa.js: below-detection ("<0.014") values ===');

// Parsing: the operator may be attached, spaced, ≤, or <=
var cen1 = parseLine('2024-01-15 <0.014');
assert(cen1 !== null, 'parseLine: "<0.014" parses');
assertEqual(cen1.censored, true, 'parseLine: "<0.014" flagged censored');
assertClose(cen1.psaValue, 0.014, 1e-9, 'parseLine: "<0.014" keeps the limit as the value');
assertEqual(parseLine('2024-01-15 < 0.014').censored, true, 'parseLine: spaced "< 0.014" flagged censored');
assertClose(parseLine('2024-01-15 < 0.014').psaValue, 0.014, 1e-9, 'parseLine: spaced "< 0.014" value');
assertEqual(parseLine('2024-01-15, PSA <=0.02').censored, true, 'parseLine: "<=0.02" flagged censored');
assertEqual(parseLine('2024-01-15 ≤0.02').censored, true, 'parseLine: "≤0.02" flagged censored');
assertEqual(parseLine('2024-01-15 0.014').censored, false, 'parseLine: plain value not censored');
assertEqual(parseLine('2024-01-15 <abc'), null, 'parseLine: "<" with no number still rejected');

// Display: the row keeps its operator
assertEqual(fmtPsaCell({ psaValue: 0.014, censored: true }), '< 0.014', 'fmtPsaCell: censored keeps "<"');
assertEqual(fmtPsaCell({ psaValue: 0.014, censored: false }), '0.014', 'fmtPsaCell: measured has no operator');
assertEqual(fmtPsaCell({ psaValue: 4.5, censored: true }), '< 4.50', 'fmtPsaCell: censored uses the same precision rule');

// Fit + velocity exclude censored rows
var mixed = [
  { date: new Date(2024, 0, 1), psaValue: 0.014, censored: true },
  { date: new Date(2024, 6, 1), psaValue: 0.020, censored: false },
  { date: new Date(2025, 0, 1), psaValue: 0.040, censored: false },
];
var mixedFit = fitExponential(mixed);
assert(mixedFit !== null, 'fitExponential: mixed series fits on the measured points');
assertEqual(mixedFit.n, 2, 'fitExponential: censored row excluded from n');
var measuredOnlyFit = fitExponential(mixed.slice(1));
assertClose(mixedFit.doublingTimeDays, measuredOnlyFit.doublingTimeDays, 1e-9,
  'fitExponential: censored row does not shift the doubling time');
assertClose(psaVelocity(mixed), psaVelocity(mixed.slice(1)), 1e-9,
  'psaVelocity: censored row excluded');

// All-undetectable series has nothing to fit (calculate() reports this)
assertEqual(fitExponential([
  { date: new Date(2024, 0, 1), psaValue: 0.014, censored: true },
  { date: new Date(2024, 6, 1), psaValue: 0.014, censored: true },
]), null, 'fitExponential: all-censored series returns null');

// Dedupe: "<0.014" and a measured 0.014 on the same day are distinct readings
var cenDedupe = dedupeMeasurements([
  { date: new Date(2024, 0, 1), psaValue: 0.014, censored: true },
  { date: new Date(2024, 0, 1), psaValue: 0.014, censored: false },
  { date: new Date(2024, 0, 1), psaValue: 0.014, censored: true },
]);
assertEqual(cenDedupe.length, 2, 'dedupeMeasurements: censored vs measured kept, exact duplicate dropped');
assertEqual(cenDedupe[0].censored, true, 'dedupeMeasurements: keeps first occurrence (censored)');
assertEqual(cenDedupe[1].censored, false, 'dedupeMeasurements: measured row retained');

// End-to-end through parseInput
var cenSeries = parseInput('2024-01-15 <0.014\n2024-07-15 0.020\n2025-01-15 0.040');
assertEqual(cenSeries.length, 3, 'parseInput: below-detection row is kept, not dropped');
assertEqual(cenSeries.filter(function (d) { return d.censored; }).length, 1,
  'parseInput: exactly one row flagged censored');

section('=== psa.js: recent-trend window ===');

// Day-offset helper so series read as "day N of the series", not calendar math.
function dayPt(offset, psaValue, censored) {
  return { date: new Date(2024, 0, 1 + offset), psaValue: psaValue, censored: !!censored };
}

assertEqual(medianOf([3, 1, 2]), 2, 'medianOf: odd length');
assertEqual(medianOf([4, 1, 3, 2]), 2.5, 'medianOf: even length averages the middle pair');
assertEqual(medianOf([5]), 5, 'medianOf: single value');

// fittablePoints is the one filter the fit, velocity, and window all share
var mixedPts = [dayPt(0, 0.5), dayPt(30, 0, false), dayPt(60, 0.8, true), dayPt(90, 1.2)];
assertEqual(fittablePoints(mixedPts).length, 2, 'fittablePoints: drops zero and censored');

// Too few points to leave anything to compare against
assertEqual(recentWindow([dayPt(0, 1), dayPt(180, 2), dayPt(360, 4)]), null,
  'recentWindow: 3 fittable points → null (no earlier segment left)');

// 8 points over ~2.7 years: trailing 12 months holds 4
var longSeries = [
  dayPt(0, 1.0), dayPt(180, 1.2), dayPt(360, 1.45), dayPt(540, 1.75),
  dayPt(720, 2.2), dayPt(810, 2.9), dayPt(900, 3.7), dayPt(990, 6.0),
];
var win = recentWindow(longSeries);
assert(win !== null, 'recentWindow: long series produces a window');
assertEqual(win.points.length, 4, 'recentWindow: trailing 12 months holds 4 points');
assertEqual(win.earlier.length, 4, 'recentWindow: the rest become the earlier segment');
assertEqual(win.points[0].psaValue, 2.2, 'recentWindow: window starts at the first in-window point');

// Sparse tail: trailing 12 months holds only 2, so the window widens to 3
var sparse = [
  dayPt(0, 1.0), dayPt(200, 1.3), dayPt(400, 1.7), dayPt(1000, 2.4), dayPt(1300, 3.1),
];
var sparseWin = recentWindow(sparse);
assert(sparseWin !== null, 'recentWindow: sparse series still produces a window');
assertEqual(sparseWin.points.length, 3, 'recentWindow: widens to the 3-point minimum');
assertEqual(sparseWin.earlier.length, 2, 'recentWindow: earlier segment keeps the remainder');

// Clustered tail: 3 recent draws inside 3 weeks is not a trend — widen for span
var clustered = [
  dayPt(0, 1.0), dayPt(300, 1.4), dayPt(600, 1.9), dayPt(900, 2.5),
  dayPt(907, 2.6), dayPt(914, 2.7),
];
var clusteredWin = recentWindow(clustered);
assert(clusteredWin !== null, 'recentWindow: clustered tail still produces a window');
assert((clusteredWin.points[clusteredWin.points.length - 1].date - clusteredWin.points[0].date)
  / 86400000 >= 90, 'recentWindow: window span is at least 90 days');

// Censored and zero rows never enter the window
var withCensored = longSeries.concat([dayPt(1050, 0.014, true)]);
var censWin = recentWindow(withCensored);
assert(censWin.points.every(function (p) { return !p.censored; }),
  'recentWindow: below-detection rows excluded from the window');

section('=== psa.js: compareTrend ===');

// Slow earlier segment, fast recent segment (DT ~22 mo → ~6 mo)
var accelWin = recentWindow(longSeries);
var accel = compareTrend(fitExponential(accelWin.points), fitExponential(accelWin.earlier));
assert(accel !== null, 'compareTrend: returns a verdict for two 4-point segments');
assertEqual(accel.differs, true, 'compareTrend: clear acceleration is flagged');
assertEqual(accel.direction, 'increased', 'compareTrend: direction names the rate constant');

// One constant slope across the whole series, with mild scatter
var steady = [
  dayPt(0, 1.00), dayPt(180, 1.42), dayPt(360, 1.98), dayPt(540, 2.85),
  dayPt(720, 3.9), dayPt(810, 4.8), dayPt(900, 5.6), dayPt(990, 6.7),
];
var steadyWin = recentWindow(steady);
var steadyCmp = compareTrend(fitExponential(steadyWin.points), fitExponential(steadyWin.earlier));
assert(steadyCmp !== null, 'compareTrend: returns a verdict for a steady series');
assertEqual(steadyCmp.differs, false, 'compareTrend: steady growth is not flagged as a change');

// A 2-point segment has no residual d.o.f., so varB is a fake zero — no claim
assertEqual(compareTrend(
  fitExponential([dayPt(0, 1), dayPt(100, 2)]),
  fitExponential([dayPt(200, 3), dayPt(300, 9)])
), null, 'compareTrend: 2-point segments → null (no estimable noise level)');
assertEqual(compareTrend(null, fitExponential(longSeries)), null, 'compareTrend: null input → null');

section('=== psa.js: noiseCaveat ===');

// Under the 20% noise floor across the whole series
assert(/assay and biological/.test(noiseCaveat([dayPt(0, 4.00), dayPt(200, 4.10), dayPt(400, 4.15)])),
  'noiseCaveat: sub-20% total change is called out as possible noise');

// Ordinary rising series at ordinary levels → no caveat
assertEqual(noiseCaveat([dayPt(0, 1.0), dayPt(200, 2.0), dayPt(400, 4.0)]), null,
  'noiseCaveat: a clear rise at ordinary levels needs no caveat');

// Ultrasensitive levels get the assay-scatter caveat even when the rise is real
assert(/ultrasensitive/i.test(noiseCaveat([dayPt(0, 0.010), dayPt(200, 0.020), dayPt(400, 0.045)])),
  'noiseCaveat: ultrasensitive series warns about assay scatter');

// The noise floor outranks the ultrasensitive note (one message, most important)
assert(/assay and biological/.test(noiseCaveat([dayPt(0, 0.020), dayPt(200, 0.021), dayPt(400, 0.022)])),
  'noiseCaveat: flat ultrasensitive series reports the noise floor, not the scatter note');

assertEqual(noiseCaveat([dayPt(0, 1.0)]), null, 'noiseCaveat: single point → no caveat');

section('=== psa.js: lastFittedDateMs (projection divider) ===');

// Regression: a trailing row the fit ignored must not push the "measured →
// projected" divider right, which would render extrapolation as measured data.
var jan = new Date(2024, 0, 15), jul = new Date(2024, 6, 15), dec = new Date(2024, 11, 15);
assertEqual(lastFittedDateMs([
  { date: jan, psaValue: 0.02, censored: false },
  { date: jul, psaValue: 0.04, censored: false },
]), jul.getTime(), 'lastFittedDateMs: all measured → last row');
assertEqual(lastFittedDateMs([
  { date: jan, psaValue: 0.02, censored: false },
  { date: jul, psaValue: 0.04, censored: false },
  { date: dec, psaValue: 0.014, censored: true },
]), jul.getTime(), 'lastFittedDateMs: trailing below-detection row does not move the divider');
assertEqual(lastFittedDateMs([
  { date: jan, psaValue: 0.02, censored: false },
  { date: jul, psaValue: 0.04, censored: false },
  { date: dec, psaValue: 0, censored: false },
]), jul.getTime(), 'lastFittedDateMs: trailing PSA=0 row does not move the divider');
assertEqual(lastFittedDateMs([
  { date: jan, psaValue: 0.014, censored: true },
  { date: jul, psaValue: 0.02, censored: false },
]), jul.getTime(), 'lastFittedDateMs: leading censored row ignored');
assertEqual(lastFittedDateMs([
  { date: jan, psaValue: 0.014, censored: true },
  { date: jul, psaValue: 0.014, censored: true },
]), jul.getTime(), 'lastFittedDateMs: nothing fittable → falls back to last row');

section('=== psa.js: updateParsedTable DOM behavior ===');

// Minimal <table> stand-in: one header row, insertRow/insertCell/deleteRow.
function makeFakeTable() {
  var rows = [{ header: true }];
  return {
    rows: rows,
    deleteRow: function (i) { rows.splice(i < 0 ? rows.length + i : i, 1); },
    insertRow: function () {
      var row = {
        className: '',
        cells: [],
        insertCell: function () {
          var cell = { textContent: '', title: '' };
          this.cells.push(cell);
          return cell;
        }
      };
      rows.push(row);
      return row;
    }
  };
}

var fakeTable = makeFakeTable();
var origGetById = sandbox.document.getElementById;
sandbox.document.getElementById = function (id) {
  return id === 'parsedTable' ? fakeTable : origGetById(id);
};

updateParsedTable([
  { date: new Date(2024, 0, 15), psaValue: 0.014, censored: true },
  { date: new Date(2024, 6, 15), psaValue: 0.020, censored: false },
]);

assertEqual(fakeTable.rows.length, 3, 'updateParsedTable: header + one row per measurement');
assertEqual(fakeTable.rows[1].className, 'psa-row-censored', 'updateParsedTable: censored row is class-tagged');
assertEqual(fakeTable.rows[1].cells[1].textContent, '< 0.014', 'updateParsedTable: censored cell keeps "<"');
assert(fakeTable.rows[1].cells[1].title.indexOf('excluded from the fit') !== -1,
  'updateParsedTable: censored cell explains itself on hover');
assertEqual(fakeTable.rows[2].className, '', 'updateParsedTable: measured row untagged');
assertEqual(fakeTable.rows[2].cells[1].textContent, '0.020', 'updateParsedTable: measured cell has no operator');
assertEqual(fakeTable.rows[2].cells[1].title, '', 'updateParsedTable: measured cell has no tooltip');

// Re-render clears prior rows instead of appending to them
updateParsedTable([{ date: new Date(2025, 0, 1), psaValue: 4.5, censored: false }]);
assertEqual(fakeTable.rows.length, 2, 'updateParsedTable: re-render clears old rows');
assertEqual(fakeTable.rows[1].cells[1].textContent, '4.50', 'updateParsedTable: re-render shows the new value');

sandbox.document.getElementById = origGetById;

// ============================================================
// TESTS: composite.js — TDF validation boundary
// ============================================================

section('=== composite.js: TDF validation ===');

// We can't easily test DOM-dependent code, but we verify the shared math
// that composite.js relies on handles edge cases correctly.

// Remaining dose with zero BED remaining
assertEqual(isoeffDose(0, 10, 3), 0, 'isoeffDose: 0 BED returns 0 dose');

// Very small remaining BED
var smallDose = isoeffDose(0.001, 5, 3);
assert(smallDose !== null && smallDose >= 0, 'isoeffDose: very small BED produces non-negative dose');

// ============================================================
// TESTS: url-state.js — parseUrlParams / serializeToUrl
// ============================================================

section('=== url-state.js: parseUrlParams ===');

// Simulate URL search string by temporarily setting window.location.search
sandbox.window.location.search = '?bd-dose=60&bd-fx=30&ab1=10';
var parsed = parseUrlParams.call(sandbox, ['bd-dose', 'bd-fx', 'ab1', 'ab2']);
assertEqual(parsed['bd-dose'], 60, 'parseUrlParams: parses bd-dose=60');
assertEqual(parsed['bd-fx'], 30, 'parseUrlParams: parses bd-fx=30');
assertEqual(parsed['ab1'], 10, 'parseUrlParams: parses ab1=10');
assert(parsed['ab2'] === undefined, 'parseUrlParams: missing param returns undefined');

// Empty search string
sandbox.window.location.search = '';
var emptyParsed = parseUrlParams.call(sandbox, ['bd-dose']);
assertEqual(Object.keys(emptyParsed).length, 0, 'parseUrlParams: empty string returns empty object');

// Invalid values (NaN, text)
sandbox.window.location.search = '?bd-dose=abc&bd-fx=-5&ab1=Infinity';
var invalidParsed = parseUrlParams.call(sandbox, ['bd-dose', 'bd-fx', 'ab1']);
assert(invalidParsed['bd-dose'] === undefined, 'parseUrlParams: NaN value is filtered out');
assertEqual(invalidParsed['bd-fx'], -5, 'parseUrlParams: negative values are kept (validation is caller responsibility)');
assert(invalidParsed['ab1'] === undefined, 'parseUrlParams: Infinity is filtered out');

// Reset
sandbox.window.location.search = '';

section('=== url-state.js: serializeToUrl ===');

// Set up DOM elements for serialization
var doseEl = makeDomElement(); doseEl.value = '60';
var fxEl = makeDomElement(); fxEl.value = '30';
var emptyEl = makeDomElement(); emptyEl.value = '';
sandbox.document.getElementById = function(id) {
  if (id === 'bd-dose') return doseEl;
  if (id === 'bd-fx') return fxEl;
  if (id === 'empty') return emptyEl;
  return makeDomElement();
};

var url = serializeToUrl.call(sandbox, ['bd-dose', 'bd-fx', 'empty']);
assert(url.indexOf('bd-dose=60') !== -1, 'serializeToUrl: includes bd-dose=60');
assert(url.indexOf('bd-fx=30') !== -1, 'serializeToUrl: includes bd-fx=30');
assert(url.indexOf('empty') === -1, 'serializeToUrl: excludes empty values');

// Restore generic getElementById
sandbox.document.getElementById = function() { return makeDomElement(); };

// ============================================================
// TESTS: history.js — saveToHistory / loadHistory / clearHistory
// ============================================================

section('=== history.js: saveToHistory / loadHistory ===');

// Clear any prior state
sandbox.localStorage.clear();

// Save a history entry
var histDoseEl = makeDomElement(); histDoseEl.value = '60';
var histFxEl = makeDomElement(); histFxEl.value = '30';
sandbox.document.getElementById = function(id) {
  if (id === 'bd-dose') return histDoseEl;
  if (id === 'bd-fx') return histFxEl;
  return makeDomElement();
};

saveToHistory.call(sandbox, 'bed', ['bd-dose', 'bd-fx']);
var hist = loadHistory.call(sandbox, 'bed');
assertEqual(hist.length, 1, 'history: 1 entry after first save');
assertEqual(hist[0].params['bd-dose'], '60', 'history: saved bd-dose value');
assertEqual(hist[0].params['bd-fx'], '30', 'history: saved bd-fx value');

// Save a second entry (different values)
histDoseEl.value = '50';
histFxEl.value = '25';
saveToHistory.call(sandbox, 'bed', ['bd-dose', 'bd-fx']);
hist = loadHistory.call(sandbox, 'bed');
assertEqual(hist.length, 2, 'history: 2 entries after second save');
assertEqual(hist[0].params['bd-dose'], '50', 'history: newest entry first');

// Deduplication — save same as first entry again
histDoseEl.value = '60';
histFxEl.value = '30';
saveToHistory.call(sandbox, 'bed', ['bd-dose', 'bd-fx']);
hist = loadHistory.call(sandbox, 'bed');
assertEqual(hist.length, 2, 'history: deduplicate keeps count at 2');
assertEqual(hist[0].params['bd-dose'], '60', 'history: deduped entry moved to top');

// Cap at HISTORY_MAX
for (var h = 0; h < 15; h++) {
  histDoseEl.value = String(h);
  histFxEl.value = '1';
  saveToHistory.call(sandbox, 'bed', ['bd-dose', 'bd-fx']);
}
hist = loadHistory.call(sandbox, 'bed');
assert(hist.length <= 10, 'history: capped at 10 entries, got ' + hist.length);

// Clear history
clearHistory.call(sandbox, 'bed');
hist = loadHistory.call(sandbox, 'bed');
assertEqual(hist.length, 0, 'history: cleared');

// Corrupted JSON
sandbox.localStorage.setItem('history_bed', 'not valid json{{{');
hist = loadHistory.call(sandbox, 'bed');
assertEqual(hist.length, 0, 'history: corrupted JSON returns empty array');

// extraParams (ReRT OAR selection + per-OAR doses) merge into the saved params
// and participate in dedup — see saveToHistory(toolName, inputIds, extraParams).
sandbox.localStorage.clear();
var rPrFxEl = makeDomElement(); rPrFxEl.value = '25';
var rPrAbEl = makeDomElement(); rPrAbEl.value = '2.5';
var rPrMoEl = makeDomElement(); rPrMoEl.value = '12';
var rCustEl = makeDomElement(); rCustEl.value = '10';
sandbox.document.getElementById = function(id) {
  if (id === 'pr-fx') return rPrFxEl;
  if (id === 'pr-ab') return rPrAbEl;
  if (id === 'pr-mo') return rPrMoEl;
  if (id === 'custom-fx') return rCustEl;
  return makeDomElement();
};
var rIds = ['pr-fx', 'pr-ab', 'pr-mo', 'custom-fx'];
saveToHistory.call(sandbox, 'rert', rIds,
  { 'rert-oars': 'bladder,spinalcord', 'dose-bladder': '70', 'dose-spinalcord': '45' });
var rHist = loadHistory.call(sandbox, 'rert');
assertEqual(rHist.length, 1, 'history(rert): 1 entry after save');
assertEqual(rHist[0].params['pr-fx'], '25', 'history(rert): plan input saved');
assertEqual(rHist[0].params['rert-oars'], 'bladder,spinalcord',
  'history(rert): extraParams rert-oars merged into params');
assertEqual(rHist[0].params['dose-bladder'], '70', 'history(rert): dose-bladder merged');
assertEqual(rHist[0].params['dose-spinalcord'], '45', 'history(rert): dose-spinalcord merged');

// A dose-only change (extraParams differ, inputIds identical) is a distinct entry.
saveToHistory.call(sandbox, 'rert', rIds,
  { 'rert-oars': 'bladder,spinalcord', 'dose-bladder': '60', 'dose-spinalcord': '45' });
rHist = loadHistory.call(sandbox, 'rert');
assertEqual(rHist.length, 2, 'history(rert): dose-only change creates a new entry');

// Re-saving identical full state dedupes and moves it to the top.
saveToHistory.call(sandbox, 'rert', rIds,
  { 'rert-oars': 'bladder,spinalcord', 'dose-bladder': '70', 'dose-spinalcord': '45' });
rHist = loadHistory.call(sandbox, 'rert');
assertEqual(rHist.length, 2, 'history(rert): identical full state dedupes');
assertEqual(rHist[0].params['dose-bladder'], '70', 'history(rert): deduped entry moved to top');

// Restore
sandbox.localStorage.clear();
sandbox.document.getElementById = function() { return makeDomElement(); };

// ============================================================
// TESTS: url-state.js — buildToolUrl (used by the hub recents)
// ============================================================

section('=== url-state.js: buildToolUrl ===');

// Empty params → bare path (no trailing ?)
assertEqual(buildToolUrl.call(sandbox, 'bed.html', {}), 'bed.html',
  'buildToolUrl: empty params yields bare path');

// Typical use
var btUrl = buildToolUrl.call(sandbox, 'bed.html', { 'bd-dose': 60, 'bd-fx': 30 });
assert(btUrl.indexOf('bd-dose=60') !== -1, 'buildToolUrl: bd-dose=60 present');
assert(btUrl.indexOf('bd-fx=30') !== -1, 'buildToolUrl: bd-fx=30 present');
assert(btUrl.indexOf('bed.html?') === 0, 'buildToolUrl: starts with toolPath?');

// Empty-string / null / undefined values are skipped (matches serializeToUrl)
var btSkip = buildToolUrl.call(sandbox, 'bed.html', {
  'bd-dose': 60, 'bd-fx': '', 'ab1': null, 'ab2': undefined
});
assert(btSkip.indexOf('bd-dose=60') !== -1, 'buildToolUrl: kept bd-dose=60');
assert(btSkip.indexOf('bd-fx') === -1, 'buildToolUrl: empty-string skipped');
assert(btSkip.indexOf('ab1') === -1, 'buildToolUrl: null skipped');
assert(btSkip.indexOf('ab2') === -1, 'buildToolUrl: undefined skipped');

// Round-trip: build URL → parse it back → params match
var rtParams = { 'bd-dose': 70, 'bd-fx': 35, 'ab1': 10, 'ab2': 3 };
var rtUrl = buildToolUrl.call(sandbox, 'bed.html', rtParams);
// parseUrlParams reads window.location.search, so we simulate it:
sandbox.window.location.search = rtUrl.substring(rtUrl.indexOf('?'));
var rtParsed = parseUrlParams.call(sandbox, ['bd-dose', 'bd-fx', 'ab1', 'ab2']);
assertEqual(rtParsed['bd-dose'], 70, 'buildToolUrl round-trip: bd-dose=70 recovered');
assertEqual(rtParsed['bd-fx'], 35,  'buildToolUrl round-trip: bd-fx=35 recovered');
assertEqual(rtParsed['ab1'], 10,    'buildToolUrl round-trip: ab1=10 recovered');
assertEqual(rtParsed['ab2'], 3,     'buildToolUrl round-trip: ab2=3 recovered');
sandbox.window.location.search = ''; // restore

// ============================================================
// TESTS: history.js — per-tool summary functions
// ============================================================

section('=== history.js: bedSummary ===');
assertEqual(bedSummary({ 'bd-dose': '60', 'bd-fx': '30' }), '60 Gy / 30 fx · 2 Gy/fx',
  'bedSummary: dose/fx adds derived Gy/fx');
assertEqual(bedSummary({ 'bd-dose': '55', 'bd-fx': '20', 'ab1': '10' }),
  '55 Gy / 20 fx · 2.75 Gy/fx · α/β 10', 'bedSummary: full entry with α/β');
assertEqual(bedSummary({ 'bd-fx': '30' }), '? Gy / 30 fx',
  'bedSummary: missing bd-dose → ? and no Gy/fx');
assertEqual(bedSummary({ 'bd-dose': '60' }), '60 Gy / ? fx',
  'bedSummary: missing bd-fx → ? and no Gy/fx');
assertEqual(bedSummary({}), '? Gy / ? fx',
  'bedSummary: empty params → ? / ?');

section('=== history.js: compositeSummary ===');
assertEqual(compositeSummary({ 'st-dose': '50', 'pv-dose': '60' }),
  'Tol 50 Gy · Prior 60 Gy', 'compositeSummary: doses only');
assertEqual(compositeSummary({ 'st-dose': '50', 'st-fx': '25', 'pv-dose': '60', 'pv-fx': '30', 'pv-tdf': '0.5' }),
  'Tol 50 Gy/25 fx · Prior 60 Gy/30 fx · TDF 0.5', 'compositeSummary: full entry with fx + TDF');
assertEqual(compositeSummary({ 'pv-dose': '60' }),
  'Tol ? Gy · Prior 60 Gy', 'compositeSummary: missing st-dose');
assertEqual(compositeSummary({ 'st-dose': '50' }),
  'Tol 50 Gy · Prior ? Gy', 'compositeSummary: missing pv-dose');
assertEqual(compositeSummary({}),
  'Tol ? Gy · Prior ? Gy', 'compositeSummary: empty params');

section('=== history.js: rertSummary ===');
assertEqual(rertSummary({ 'pr-fx': '25', 'pr-mo': '18' }),
  'prior 25 fx, 18 mo ago', 'rertSummary: both fields present');
assertEqual(rertSummary({ 'pr-mo': '18' }),
  'prior ? fx, 18 mo ago', 'rertSummary: missing pr-fx');
assertEqual(rertSummary({ 'pr-fx': '25' }),
  'prior 25 fx, ? mo ago', 'rertSummary: missing pr-mo');
assertEqual(rertSummary({}),
  'prior ? fx, ? mo ago', 'rertSummary: empty params');
assertEqual(rertSummary({ 'pr-fx': '25', 'pr-mo': '18', 'rert-oars': 'bladder' }),
  'prior 25 fx, 18 mo ago, 1 OAR', 'rertSummary: single OAR appends count (singular)');
assertEqual(rertSummary({ 'pr-fx': '25', 'pr-mo': '18', 'rert-oars': 'bladder,spinalcord,heart' }),
  'prior 25 fx, 18 mo ago, 3 OARs', 'rertSummary: multiple OARs pluralized');
assertEqual(rertSummary({ 'pr-fx': '25', 'pr-mo': '18', 'rert-oars': '' }),
  'prior 25 fx, 18 mo ago', 'rertSummary: empty rert-oars omits OAR clause');
assertEqual(rertSummary({ 'pr-fx': '30', 'pr-ab': '2.5', 'pr-mo': '8', 'rert-oars': 'bladder,heart' }),
  'prior 30 fx (α/β 2.5), 8 mo ago, 2 OARs', 'rertSummary: full entry with α/β + OAR count');

section('=== history.js: psaSummary ===');
assertEqual(psaSummary({ 'psa-dt': '8.4 mo', 'psa-n': '5', 'psa-span': 'Jan 2023 – Jun 2025' }),
  '8.4 mo · 5 values · Jan 2023 – Jun 2025', 'psaSummary: full label');
assertEqual(psaSummary({ 'psa-dt': '12 d', 'psa-n': '1' }),
  '12 d · 1 value', 'psaSummary: singular value, no span');
assertEqual(psaSummary({ 'psa-dt': 'decreasing', 'psa-n': '4' }),
  'decreasing · 4 values', 'psaSummary: decreasing PSA');
assertEqual(psaSummary({}),
  '? doubling time', 'psaSummary: empty params fallback');

section('=== history.js: trimNum ===');
assertEqual(trimNum(2), '2', 'trimNum: integer stays integer');
assertEqual(trimNum(2.75), '2.75', 'trimNum: two decimals kept');
assertEqual(trimNum(8 / 3), '2.67', 'trimNum: rounds to 2 decimals');

section('=== history.js: relativeTime ===');
var NOW = Date.now();
assertEqual(relativeTime(NOW), 'just now', 'relativeTime: now → just now');
assertEqual(relativeTime(NOW - 5 * 60 * 1000), '5m ago', 'relativeTime: 5 minutes');
assertEqual(relativeTime(NOW - 3 * 60 * 60 * 1000), '3h ago', 'relativeTime: 3 hours');
assertEqual(relativeTime(NOW - 2 * 24 * 60 * 60 * 1000), '2d ago', 'relativeTime: 2 days');
assert(/[A-Z][a-z]{2} \d/.test(relativeTime(NOW - 30 * 24 * 60 * 60 * 1000)),
  'relativeTime: >1 week falls back to short calendar date');
assertEqual(relativeTime('nope'), '', 'relativeTime: non-numeric ts → empty');

// ============================================================
// TESTS: history.js — getRecentAcrossTools (hub recents)
// ============================================================

section('=== history.js: getRecentAcrossTools ===');

// Empty localStorage → empty array
sandbox.localStorage.clear();
var recents0 = getRecentAcrossTools.call(sandbox, 3);
assertEqual(recents0.length, 0, 'getRecentAcrossTools: empty localStorage → []');

// Only BED has entries — only BED returned, tagged correctly
sandbox.localStorage.setItem('history_bed', JSON.stringify([
  { ts: 2000, params: { 'bd-dose': '60', 'bd-fx': '30' } },
  { ts: 1000, params: { 'bd-dose': '70', 'bd-fx': '35' } }
]));
var recentsBed = getRecentAcrossTools.call(sandbox, 3);
assertEqual(recentsBed.length, 2, 'getRecentAcrossTools: BED-only → 2 entries');
assertEqual(recentsBed[0].tool, 'bed', 'getRecentAcrossTools: entry tagged tool=bed');
assertEqual(recentsBed[0].path, 'bed.html', 'getRecentAcrossTools: entry tagged path=bed.html');
assertEqual(recentsBed[0].ts, 2000, 'getRecentAcrossTools: newest first (ts=2000)');
assertEqual(recentsBed[0].label, '60 Gy / 30 fx · 2 Gy/fx', 'getRecentAcrossTools: label from bedSummary');

// All three tools populated → merged + sorted by ts desc
sandbox.localStorage.setItem('history_composite', JSON.stringify([
  { ts: 3000, params: { 'st-dose': '50', 'pv-dose': '60' } }
]));
sandbox.localStorage.setItem('history_rert', JSON.stringify([
  { ts: 1500, params: { 'pr-fx': '25', 'pr-mo': '18' } }
]));
var recentsAll = getRecentAcrossTools.call(sandbox, 3);
assertEqual(recentsAll.length, 3, 'getRecentAcrossTools: three tools merged → 3');
assertEqual(recentsAll[0].tool, 'composite', 'getRecentAcrossTools: composite ts=3000 is newest');
assertEqual(recentsAll[1].tool, 'bed',       'getRecentAcrossTools: bed ts=2000 second');
assertEqual(recentsAll[2].tool, 'rert',      'getRecentAcrossTools: rert ts=1500 third');

// PSA participates in the merge too (added to KNOWN_TOOLS)
sandbox.localStorage.setItem('history_psa', JSON.stringify([
  { ts: 4000, params: { 'psaInput': '2023-01-01 1.2\n2024-01-01 2.4', 'projectionYears': '2',
    'psa-dt': '12 mo', 'psa-n': '2', 'psa-span': 'Jan 2023 – Jan 2024' } }
]));
var recentsPsa = getRecentAcrossTools.call(sandbox, 4);
assertEqual(recentsPsa[0].tool, 'psa', 'getRecentAcrossTools: psa ts=4000 newest');
assertEqual(recentsPsa[0].path, 'psa.html', 'getRecentAcrossTools: psa tagged path=psa.html');
assertEqual(recentsPsa[0].label, '12 mo · 2 values · Jan 2023 – Jan 2024',
  'getRecentAcrossTools: psa label from psaSummary');
sandbox.localStorage.removeItem('history_psa');

// Default limit = 3 (slices when more entries exist)
sandbox.localStorage.setItem('history_bed', JSON.stringify([
  { ts: 2000, params: { 'bd-dose': '60', 'bd-fx': '30' } },
  { ts: 1000, params: { 'bd-dose': '70', 'bd-fx': '35' } },
  { ts: 500,  params: { 'bd-dose': '80', 'bd-fx': '40' } }
]));
var recentsDefault = getRecentAcrossTools.call(sandbox); // no limit arg
assertEqual(recentsDefault.length, 3, 'getRecentAcrossTools: default limit = 3');

// Defensive filter: entries missing ts or params are dropped, not rendered
sandbox.localStorage.setItem('history_bed', JSON.stringify([
  { ts: 2000, params: { 'bd-dose': '60', 'bd-fx': '30' } }, // good
  { ts: 'not-a-number', params: { 'bd-dose': '99' } },      // bad ts
  { ts: 1000 },                                             // missing params
  { params: { 'bd-dose': '99' } }                           // missing ts
]));
sandbox.localStorage.removeItem('history_composite');
sandbox.localStorage.removeItem('history_rert');
var recentsFiltered = getRecentAcrossTools.call(sandbox, 5);
assertEqual(recentsFiltered.length, 1,
  'getRecentAcrossTools: malformed entries filtered, only the well-formed one kept');
assertEqual(recentsFiltered[0].params['bd-dose'], '60',
  'getRecentAcrossTools: kept entry has correct payload');

sandbox.localStorage.clear();

// ============================================================
// TESTS: clipboard.js — copyToClipboard exists
// ============================================================

section('=== clipboard.js ===');
assert(typeof copyToClipboard === 'function', 'copyToClipboard is a function');

// ============================================================
// validate.js — fat-finger guardrails
// ============================================================

section('=== validate.js: classifyRange ===');

var fxRange      = { min: 1,   max: 80, label: 'Typical: 1–45 fx (>80 is rare)', integer: true };
var fxRangeNoInt = { min: 1,   max: 80, label: 'Typical: 1–45 fx (>80 is rare)' };
var doseRange    = { min: 0.1, max: 200, label: 'Typical: 1–80 Gy' };

assertEqual(classifyRange(NaN, fxRange),    'ok',        'NaN → ok (blank input, no warning)');
assertEqual(classifyRange(-1,  fxRange),    'negative',  '-1 fx → negative');
assertEqual(classifyRange(-0.5, doseRange), 'negative',  '-0.5 Gy → negative');
assertEqual(classifyRange(0,   fxRange),    'low',       '0 fx → low (below min=1)');
assertEqual(classifyRange(1,   fxRange),    'ok',        '1 fx → ok (at min)');
assertEqual(classifyRange(45,  fxRange),    'ok',        '45 fx → ok (typical)');
assertEqual(classifyRange(80,  fxRange),    'ok',        '80 fx → ok (at max)');
assertEqual(classifyRange(81,  fxRange),    'high',      '81 fx → high (above 80)');
assertEqual(classifyRange(120, fxRange),    'high',      '120 fx → high (fat-finger)');
assertEqual(classifyRange(0.1, doseRange),  'ok',        '0.1 Gy → ok (at min)');
assertEqual(classifyRange(80,  doseRange),  'ok',        '80 Gy → ok (typical max)');
assertEqual(classifyRange(200, doseRange),  'ok',        '200 Gy → ok (at max)');
assertEqual(classifyRange(201, doseRange),  'high',      '201 Gy → high');

// Integer enforcement — fractions must be whole numbers
assertEqual(classifyRange(25.5,  fxRange),      'non-integer', '25.5 fx → non-integer (decimal not allowed)');
assertEqual(classifyRange(1.5,   fxRange),      'non-integer', '1.5 fx → non-integer');
assertEqual(classifyRange(0.5,   fxRange),      'non-integer', '0.5 fx → non-integer (precedes the low check)');
assertEqual(classifyRange(25,    fxRange),      'ok',          '25 fx → ok (clean integer)');
assertEqual(classifyRange(25.0,  fxRange),      'ok',          '25.0 fx → ok (parseFloat treats as 25)');
assertEqual(classifyRange(25.5,  fxRangeNoInt), 'ok',          '25.5 fx with no integer flag → ok');
assertEqual(classifyRange(2.75,  doseRange),    'ok',          '2.75 Gy → ok (dose allows decimals)');
assertEqual(classifyRange(-1.5,  fxRange),      'negative',    '-1.5 → negative wins over non-integer');

section('=== validate.js: RERT_RANGES wiring ===');

assert(RERT_RANGES['pr-fx'].max === 80,        'pr-fx max is 80');
assert(RERT_RANGES['pr-ab'].max === 30,        'pr-ab max is 30');
assert(!RERT_RANGES['pr-ab'].integer,          'pr-ab is NOT integer (α/β commonly 1.5, 2.5)');
assert(RERT_RANGES['pr-mo'].min === 0,         'pr-mo min is 0 (no negative months)');
assert(RERT_RANGES['pr-mo'].integer === true,  'pr-mo is integer (clinical months are whole)');
assert(RERT_RANGES['custom-fx'].max === 80,    'custom-fx max is 80');
assertEqual(classifyRange(6.5, RERT_RANGES['pr-mo']), 'non-integer', '6.5 months → non-integer');
assertEqual(classifyRange(6,   RERT_RANGES['pr-mo']), 'ok',          '6 months → ok');
assertEqual(classifyRange(2.5, RERT_RANGES['pr-ab']), 'ok',          '2.5 α/β → ok (decimals allowed)');
assert(OAR_DOSE_RANGE_GY.max === 200,          'OAR Gy dose max is 200');
assert(OAR_DOSE_RANGE_CC.max === 5000,         'OAR cc volume max is 5000');

section('=== validate.js: applyRangeWarning DOM behavior ===');

function makeWarn() {
  return { textContent: '', style: { display: 'none' },
           classList: {
             _set: {},
             add: function(c) { this._set[c] = true; },
             remove: function(c) { delete this._set[c]; },
             contains: function(c) { return !!this._set[c]; }
           } };
}

var input80 = { value: '80' };
var warn80  = makeWarn();
applyRangeWarning(input80, warn80, fxRange);
assertEqual(warn80.style.display, 'none', '80 fx (at max) shows no warning');

var input81 = { value: '81' };
var warn81  = makeWarn();
applyRangeWarning(input81, warn81, fxRange);
assertEqual(warn81.style.display, 'block', '81 fx triggers warning');
assert(!warn81.classList.contains('input-range-error'), '81 fx is soft warn, not error');

var inputNeg = { value: '-5' };
var warnNeg  = makeWarn();
applyRangeWarning(inputNeg, warnNeg, fxRange);
assertEqual(warnNeg.style.display, 'block', 'negative value triggers warning');
assert(warnNeg.classList.contains('input-range-error'), 'negative gets red error class');
assert(warnNeg.textContent.indexOf('negative') !== -1, 'negative message mentions "negative"');

var inputBlank = { value: '' };
var warnBlank  = makeWarn();
applyRangeWarning(inputBlank, warnBlank, fxRange);
assertEqual(warnBlank.style.display, 'none', 'blank input → no warning');

// Integer fraction enforcement at DOM level
var inputDecimal = { value: '25.5' };
var warnDecimal  = makeWarn();
applyRangeWarning(inputDecimal, warnDecimal, fxRange);
assertEqual(warnDecimal.style.display, 'block', '25.5 fx triggers warning');
assert(warnDecimal.classList.contains('input-range-error'), '25.5 fx gets red error class');
assert(warnDecimal.textContent.indexOf('whole number') !== -1, 'non-integer message mentions "whole number"');

var inputDose = { value: '2.75' };
var warnDose  = makeWarn();
applyRangeWarning(inputDose, warnDose, doseRange);
assertEqual(warnDose.style.display, 'none', '2.75 Gy (dose, no integer flag) → no warning');

// ============================================================
// Summary
// ============================================================

console.log('\n' + '='.repeat(50));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(function(f) { console.log('  - ' + f); });
}
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
