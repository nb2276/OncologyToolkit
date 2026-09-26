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
// Both arguments must be real numbers — neither is coerced. isNaN('') is false,
// so a blank DOM .value would otherwise sail through as a confident 0.00. And a
// numeric-string ab is worse than it looks: `2 + ab` concatenates, so a bare
// `!(ab > 0)` check let bedToEQD2(50, '3') return 6.52 instead of 30 and
// eqd2ToBED(50, '3') return 383.33 instead of 83.33. Today's callers all
// parseFloat first, but this is shared math and a silently 4.6x-wrong dose is
// exactly what the guards here exist to stop.
function bedToEQD2(bed, ab) {
  if (typeof bed !== 'number' || !isFinite(bed)) return null;
  if (typeof ab !== 'number' || !(ab > 0)) return null;
  return bed * ab / (2 + ab);
}

// Inverse of bedToEQD2: the BED that yields this EQD2 at the same α/β.
// EQD2 = BED * ab/(2+ab), so BED = EQD2 * (2+ab)/ab.
// Lives here next to its forward direction so a future change to the α/β
// convention touches both at once — it was inlined in rert.js, where nothing
// linked the two halves of the identity.
// Same non-coercing guard on both arguments as bedToEQD2, and for the same
// reason — see the note there.
function eqd2ToBED(eqd2, ab) {
  if (typeof eqd2 !== 'number' || !isFinite(eqd2)) return null;
  if (typeof ab !== 'number' || !(ab > 0)) return null;
  return eqd2 * (2 + ab) / ab;
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
