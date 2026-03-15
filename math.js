// Shared radiation biology math used by BED, Composite, and Reirradiation calculators.

function fmt(val, decimals) {
  if (val === null || val === undefined || isNaN(val) || !isFinite(val)) return '—';
  return val.toFixed(decimals !== undefined ? decimals : 2);
}

function calcBED(D, n, ab) {
  var d = D / n;
  return D * (1 + d / ab);
}

function calcEQD2(D, n, ab) {
  var d = D / n;
  return D * (d + ab) / (2 + ab);
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
