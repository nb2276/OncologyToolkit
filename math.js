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
// Exact, not an approximation — and linear in BED, so a time-discounted BED
// converts to the correspondingly discounted EQD2.
function bedToEQD2(bed, ab) {
  if (bed === null || bed === undefined || isNaN(bed) || !(ab > 0)) return null;
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
