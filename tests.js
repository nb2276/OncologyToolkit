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
    querySelectorAll: function() { return []; },
    body: { appendChild: function() {} }
  },
  window: { addEventListener: function() {}, open: function() {} },
  navigator: { clipboard: { write: function() { return Promise.resolve(); }, writeText: function() { return Promise.resolve(); } } },
  Chart: { helpers: { getRelativePosition: function() {} }, defaults: { plugins: { legend: { onClick: function() {} } } } },
  ClipboardItem: function() {}
};

vm.createContext(sandbox);

// Load math.js — uses var/function declarations so they go on sandbox global
vm.runInContext(loadFile('math.js'), sandbox);

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
`, sandbox);

// Load psa.js — strip 'use strict', wrap to export
var psaSource = loadFile('psa.js').replace(/^'use strict';\s*/, '');
vm.runInContext(`
  ${psaSource}
  globalThis.tryParseDate = tryParseDate;
  globalThis.makeDate = makeDate;
  globalThis.parseLine = parseLine;
  globalThis.parseInput = parseInput;
  globalThis.fitExponential = fitExponential;
  globalThis.tValue95 = tValue95;
  globalThis.fmtDoublingTime = fmtDoublingTime;
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
var fitExponential = sandbox.fitExponential;
var tValue95 = sandbox.tValue95;
var fmtDoublingTime = sandbox.fmtDoublingTime;


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
