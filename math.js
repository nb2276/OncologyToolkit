// Shared radiation biology math used by BED, Composite, and Reirradiation calculators.

function fmt(val, decimals) {
  if (val === null || val === undefined || isNaN(val) || !isFinite(val)) return '—';
  var d = (decimals !== undefined)
    ? decimals
    : (typeof getDecimals === 'function' ? getDecimals() : 2);
  return val.toFixed(d);
}

function calcBED(D, n, ab) {
  var d = D / n;
  return D * (1 + d / ab);
}

function calcEQD2(D, n, ab) {
  var d = D / n;
  return D * (d + ab) / (2 + ab);
}

// EQD2 equivalent of a BED at the same α/β.
// BED = D(ab+d)/ab and EQD2 = D(ab+d)/(2+ab), so EQD2 = BED * ab/(2+ab).
// Linear in BED, so a time-discounted BED converts to the correspondingly
// discounted EQD2.
//
// Exact in algebra, NOT bit-exact in IEEE 754: (1 + d/ab)*ab is not bit-equal
// to (ab + d), so bedToEQD2(calcBED(D,n,ab), ab) can land ~1 ULP below
// calcEQD2(D,n,ab) and round the other way at an exact .xx5 tie (19 Gy/2 fx
// α/β=3 printed 47 where bed.html printed 48). Call this ONLY for a derived
// BED with no dose/fractionation of its own — remaining BED, a TDF-discounted
// BED. Whenever D and n are in hand, use calcEQD2 directly so two pages of the
// site can never disagree about the same regimen. tests.js pins that.
//
// Non-numeric input returns null rather than coercing: isNaN('') is false, so a
// blank DOM .value would otherwise sail through as a confident 0.00.
function bedToEQD2(bed, ab) {
  if (typeof bed !== 'number' || !isFinite(bed) || !(ab > 0)) return null;
  return bed * ab / (2 + ab);
}

// Given a BED, find the isoeffective total dose in nNew fractions.
// Solves BED = nNew * d * (1 + d/ab) for d, then returns nNew * d.
function isoeffDose(bed, nNew, ab) {
  var disc = ab * ab + 4 * bed * ab / nNew;
  if (disc < 0) return null;
  var d = 0.5 * (-ab + Math.sqrt(disc));
  if (d < 0) return null;
  return d * nNew;
}
