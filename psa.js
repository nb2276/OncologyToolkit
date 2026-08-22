// PSA Doubling Time Calculator
// Unweighted log-linear regression: ln(PSA) = ln(A) + B*t, so y = A * exp(B*t).
// Doubling time = ln(2)/B. This is the standard clinical PSADT method (each
// measurement weighted equally in log space, matching PSA's multiplicative
// error). PSA velocity is reported separately as a linear regression of raw
// PSA on time. Reference: https://en.wikipedia.org/wiki/Simple_linear_regression

'use strict';

// -------------------------------------------------------------------------
// Date parsing
// -------------------------------------------------------------------------

/**
 * Try to parse a single string token as a date.
 * Handles: YYYY-MM-DD, MM/DD/YYYY, MM.DD.YYYY, DD/MM/YYYY, MM/DD/YY, etc.
 * When month/day are ambiguous (both ≤12), assumes MM-first (US convention).
 * If first part > 12, assumes DD-first.
 * Returns a Date object or null.
 */
const MONTH_NAMES = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
};

function tryParseDate(token) {
  token = token.trim().replace(/^["']+|["']+$/g, '');   // survive a quoted CSV paste

  // ISO: YYYY-MM-DD
  let m = token.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return makeDate(+m[1], +m[2], +m[3]);

  // Month name, either order: "Jan 15 2024" / "15 Jan 2024". The parsed table
  // prints this shape, so without it the app cannot read its own output back.
  m = token.match(/^([A-Za-z]{3,9})(\d{1,2})(\d{4})$/);
  if (m && MONTH_NAMES[m[1].slice(0, 3).toLowerCase()]) {
    return makeDate(+m[3], MONTH_NAMES[m[1].slice(0, 3).toLowerCase()], +m[2]);
  }
  m = token.match(/^(\d{1,2})([A-Za-z]{3,9})(\d{4})$/);
  if (m && MONTH_NAMES[m[2].slice(0, 3).toLowerCase()]) {
    return makeDate(+m[3], MONTH_NAMES[m[2].slice(0, 3).toLowerCase()], +m[1]);
  }

  // General: p1 [/ - .] p2 [/ - .] p3  (separators may differ)
  m = token.match(/^(\d{1,4})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (!m) return null;

  const p1 = +m[1], p2 = +m[2], p3 = +m[3];
  const len3 = m[3].length;

  let year, month, day;

  if (p1 > 31) {
    // YYYY / MM / DD
    year = p1; month = p2; day = p3;
  } else {
    year = len3 === 2 ? 2000 + p3 : p3;
    if (p1 > 12) {
      // DD / MM / YYYY  (first part can't be a month)
      day = p1; month = p2;
    } else {
      // MM / DD / YYYY  (US default when ambiguous)
      month = p1; day = p2;
    }
  }

  return makeDate(year, month, day);
}

function makeDate(year, month, day) {
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31)     return null;
  if (year < 1900 || year > 2100) return null;
  const d = new Date(year, month - 1, day);
  // JS rolls over invalid dates (Feb 31 → Mar 3); catch that.
  if (d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

// A below-detection result: "<0.014", "< 0.014", "<=0.014", "≤0.014". Labs
// report ultrasensitive PSA this way when the assay can't resolve a value.
const CENSOR_PREFIX = /^(?:<=?|≤)/;

// A number written with thousands separators ("1,234", "1,234.5"). Matched
// against a whole field so it can never swallow a "date,value" CSV pair.
const GROUPED_NUMBER = /^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/;

// The numeric prefix parseFloat consumes from a token ("4.5ng" → "4.5").
// Captured so measurements can be echoed back exactly as entered — "0.154"
// must not re-round to "0.15", and "4.50" keeps its reported trailing zero.
const NUMERIC_PREFIX = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/;

/**
 * Parse one line of input into { date, psaValue, psaText, censored } or null.
 * Skips any token that is exactly "PSA" (case-insensitive).
 *
 * `censored` is true when the value was reported as below the assay's detection
 * limit; psaValue then holds that limit, not a measured concentration.
 * `psaText` is the value as the user typed it, for display.
 */
function parseLine(line) {
  line = line.trim();
  if (!line || line.startsWith('#')) return null;

  // Strip clock times BEFORE tokenising. A lab line like "2024-01-15 08:30 4.5"
  // otherwise splits on the colon and reads 08 as the PSA value — a wrong
  // number, silently, which is worse than refusing the line.
  line = line
    .replace(/(\d{4}-\d{2}-\d{2})T\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?Z?/gi, '$1')
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?m\.?)?/gi, ' ');

  // Glue a spelled-out date into one token so the field splitter keeps it whole.
  line = line.replace(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/g, '$1$2$3')
             .replace(/\b(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b/g, '$1$2$3');

  // Whitespace, semicolons and pipes split fields. Commas are handled per
  // field so a grouped number ("1,234") survives, while a CSV field
  // ("2024-01-15,123") still splits into a date and a value.
  const tokens = [];
  line.split(/[\s;|]+/).filter(Boolean).forEach(field => {
    if (GROUPED_NUMBER.test(field)) { tokens.push(field.replace(/,/g, '')); return; }
    field.split(/[,:]+/).filter(Boolean).forEach(t => tokens.push(t));
  });

  let date = null;
  let psaValue = null;
  let psaText = null;
  let censored = false;
  let pendingCensor = false;   // a lone "<" applies to the token that follows

  for (const token of tokens) {
    if (/^psa$/i.test(token)) continue;

    if (/^(?:<=?|≤)$/.test(token)) { pendingCensor = true; continue; }

    if (date === null) {
      const d = tryParseDate(token);
      if (d !== null) { date = d; continue; }
    }

    if (psaValue === null) {
      const bare = token.replace(/^["']+|["']+$/g, '');   // quoted CSV paste
      const cm   = CENSOR_PREFIX.exec(bare);
      const num  = cm ? bare.slice(cm[0].length) : bare;
      const n = parseFloat(num);
      if (isFinite(n) && n >= 0) {                   // reject NaN AND Infinity (1e309)
        psaValue = n;
        const nm = NUMERIC_PREFIX.exec(num);
        psaText = nm ? nm[0].replace(/^\+/, '').replace(/^\./, '0.') : null;
        censored = pendingCensor || cm !== null;
      }
    }
  }

  if (date === null || psaValue === null) return null;
  return { date, psaValue, psaText, censored };
}

/**
 * Parse the full textarea input, returning an array of
 * { date, psaValue, censored } sorted chronologically.
 */
function parseInput(text) {
  const data = text.split('\n').map(parseLine).filter(Boolean);
  data.sort((a, b) => a.date - b.date);
  return data;
}

/**
 * Non-empty, non-comment lines the parser could not read. These are dropped
 * silently otherwise, so a paste of 12 results can quietly become a fit over
 * 10 without the user noticing which two went missing.
 */
function countUnparsedLines(text) {
  return String(text).split('\n').filter(function (l) {
    const s = l.trim();
    return s && s.charAt(0) !== '#' && parseLine(l) === null;
  }).length;
}

/**
 * Drop exact-duplicate measurements — same day AND same PSA value. A reading
 * entered twice carries no extra information, so it is removed from both the
 * fit and the parsed-measurements table. Same-day DIFFERENT values are kept
 * (they are distinct readings, not duplicates). Keeps first occurrence.
 */
function dedupeMeasurements(data) {
  const seen = {};
  const out = [];
  for (const d of data) {
    // "<0.014" and a measured 0.014 on the same day are different readings.
    const key = d.date.getTime() + '|' + d.psaValue + '|' + (d.censored ? 'c' : 'm');
    if (seen[key]) continue;
    seen[key] = true;
    out.push(d);
  }
  return out;
}

// -------------------------------------------------------------------------
// Least-squares exponential fit
// -------------------------------------------------------------------------

const MS_PER_DAY = 86400000;

/**
 * Fit y = A * exp(B * x) to the data using UNWEIGHTED ordinary least squares
 * on the linearised model ln(y) = ln(A) + B*x.
 *
 * This is the standard PSA-doubling-time method (log-linear regression of
 * ln(PSA) on time). It treats each measurement equally in log space, which is
 * the right error model for PSA: measurement and biological variation scale
 * with the value (multiplicative / log-normal error → constant variance in
 * ln-space). The earlier weighted form (w = y^2) over-weighted high values and
 * is not the clinical PSADT convention; it was replaced 2026-06.
 *
 * x is measured in days from the first data point.
 *
 * Also computes the variance-covariance matrix for ln(A) and B (for confidence
 * bands + the doubling-time CI) and the log-scale R^2 goodness of fit.
 *
 * Returns { A, B, doublingTimeDays, firstDate, pts, varLnA, varB, covAB, n,
 *           rSquared, rSquaredDefined, ciEstimable } or null on failure.
 */
/**
 * The measurements a fit may use: positive, and actually measured. Below-
 * detection results carry no concentration — fitting them at their reported
 * limit would bias the slope toward that limit.
 */
function fittablePoints(data) {
  return data.filter(d => d.psaValue > 0 && !d.censored);
}

/**
 * Collapse measurements that share a date into one observation.
 *
 * Two draws on one day are two reads of the same underlying value, not two
 * independent points in time. Kept separate they anchor the fit harder to that
 * date and inflate n, narrowing the confidence interval on precision the data
 * does not have.
 *
 * `mode` matches the regression doing the asking: 'geometric' for the
 * log-linear fit (the mean of ln values IS the ln of the geometric mean, so
 * this is exactly the average the fit would take), 'arithmetic' for the
 * raw-scale velocity regression. Idempotent — collapsing twice changes nothing.
 */
function collapseSameDay(pts, mode) {
  const order = [];
  const groups = {};
  for (const p of pts) {
    const key = p.date.getTime();
    if (!groups[key]) { groups[key] = []; order.push(key); }
    groups[key].push(p);
  }

  const out = [];
  for (const key of order) {
    const group = groups[key];
    if (group.length === 1) { out.push(group[0]); continue; }

    let sum = 0;
    for (const p of group) sum += (mode === 'geometric' ? Math.log(p.psaValue) : p.psaValue);
    const mean = mode === 'geometric' ? Math.exp(sum / group.length) : sum / group.length;

    out.push({ date: group[0].date, psaValue: mean, censored: false, collapsed: group.length });
  }
  return out;
}

/** How many rows the same-day collapse folds away (0 when every date is unique). */
function sameDayCollapsedCount(data) {
  const pts = fittablePoints(data);
  return pts.length - collapseSameDay(pts, 'geometric').length;
}

function fitExponential(data) {
  const valid = collapseSameDay(fittablePoints(data), 'geometric');
  if (valid.length < 2) return null;

  const firstDate = valid[0].date;

  const pts = valid.map(d => ({
    x: (d.date.getTime() - firstDate.getTime()) / MS_PER_DAY,
    y: d.psaValue,
    date: d.date
  }));

  // Unweighted sums (w_i = 1): S1 = n, S2 = Σx, S3 = Σx², S4 = Σln y, S5 = Σx·ln y
  let S1 = 0, S2 = 0, S3 = 0, S4 = 0, S5 = 0;
  for (const { x, y } of pts) {
    const lny = Math.log(y);
    S1 += 1;
    S2 += x;
    S3 += x * x;
    S4 += lny;
    S5 += x * lny;
  }

  const denom = S1 * S3 - S2 * S2;
  if (Math.abs(denom) < 1e-15) return null;   // all points share one date

  const B = (S1 * S5 - S2 * S4) / denom;
  const lnA = (S4 - B * S2) / S1;
  const A = Math.exp(lnA);
  const doublingTimeDays = Math.log(2) / B;

  // Residual + total sums of squares in log space (for variance + R²)
  const n = pts.length;
  const meanLnY = S4 / S1;
  let ssRes = 0, ssTot = 0;
  for (const { x, y } of pts) {
    const lny = Math.log(y);
    const r   = lny - lnA - B * x;
    ssRes += r * r;
    ssTot += (lny - meanLnY) * (lny - meanLnY);
  }
  const s2 = n > 2 ? ssRes / (n - 2) : 0;

  // Variance-covariance of (lnA, B)
  const varLnA = s2 * S3 / denom;
  const varB   = s2 * S1 / denom;
  const covAB  = -s2 * S2 / denom;

  // Log-scale R². Only meaningful with ≥3 points AND non-zero spread in ln(y):
  // constant PSA gives ssTot=0 (0/0), n=2 gives a trivial R²=1. Flag both.
  const rSquaredDefined = n >= 3 && ssTot > 1e-12;
  const rSquared = rSquaredDefined ? 1 - ssRes / ssTot : null;

  // CI / bands need residual d.o.f.: n-2 ≥ 1, i.e. n ≥ 3. With n=2, varB=0
  // would fake a zero-width interval — suppress instead.
  const ciEstimable = n >= 3;

  return {
    A, B, doublingTimeDays, firstDate, pts, varLnA, varB, covAB, n,
    rSquared, rSquaredDefined, ciEstimable
  };
}

/**
 * 95% confidence interval for the doubling time, derived by inverting the CI
 * for the slope B (DT = ln2 / B).
 *
 * The inversion is only valid when B's CI does not straddle zero — if it does,
 * the doubling time is unbounded/disjoint (the trend could be flat or either
 * direction) and we must NOT show a tidy finite interval. When both bounds are
 * negative the PSA is falling and the interval is a halving-time interval.
 *
 * Returns one of:
 *   { estimable: false, reason: 'need3' | 'degenerate' | 'spanszero' }
 *   { estimable: true, loDays, hiDays, increasing }   // loDays/hiDays signed
 */
function doublingTimeCI(fit) {
  if (!fit || !fit.ciEstimable || fit.varB == null) {
    return { estimable: false, reason: 'need3' };
  }
  const seB = Math.sqrt(fit.varB);
  if (!(seB > 0) || !isFinite(seB)) {
    return { estimable: false, reason: 'degenerate' };
  }
  const tCrit = tValue95(fit.n - 2);
  const Blo = fit.B - tCrit * seB;
  const Bhi = fit.B + tCrit * seB;

  // CI for B straddles 0 → DT interval is unbounded; not estimable.
  if (Blo <= 0 && Bhi >= 0) {
    return { estimable: false, reason: 'spanszero' };
  }

  // Same sign: ln2/B is monotonic, so the endpoints map to the DT bounds.
  const d1 = Math.log(2) / Blo;
  const d2 = Math.log(2) / Bhi;
  return {
    estimable: true,
    loDays: Math.min(d1, d2),
    hiDays: Math.max(d1, d2),
    increasing: fit.B > 0
  };
}

/**
 * PSA velocity (ng/mL per year) via a SEPARATE simple linear regression of raw
 * PSA on time — the textbook PSAV method, distinct from the exponential fit.
 * Uses the same filtered set as fitExponential (psaValue>0, non-censored) for
 * consistency. Returns ng/mL/yr (may be negative = declining), or null if not
 * computable.
 */
function psaVelocity(data) {
  const valid = collapseSameDay(fittablePoints(data), 'arithmetic');
  if (valid.length < 2) return null;

  const t0 = valid[0].date.getTime();
  let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const d of valid) {
    const x = (d.date.getTime() - t0) / MS_PER_DAY;
    const y = d.psaValue;
    n++; sx += x; sy += y; sxx += x * x; sxy += x * y;
  }
  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-9) return null;   // all on one date

  const slopePerDay = (n * sxy - sx * sy) / denom;
  return slopePerDay * 365.25;
}

// -------------------------------------------------------------------------
// Recent-trend window
//
// PSA kinetics are not fixed. Post-treatment log-PSA series are empirically
// piecewise-linear rather than one straight line (Bellera 2008, Ann Epidemiol),
// and a shift in doubling time between clinical epochs carries prognostic
// weight (baseline vs off-treatment PSADT in intermittent ADT).
//
// This compares the most recent stretch of measurements against the earlier
// ones and reports the difference DESCRIPTIVELY. It must never attribute a
// change to disease biology: the usual causes — treatment start/stop, 5-ARIs,
// testosterone recovery, benign post-radiotherapy bounce, a change of assay —
// are all invisible to this page, and several of them look identical to
// progression in the numbers alone.
// -------------------------------------------------------------------------

const RECENT_WINDOW_DAYS   = 365;   // preferred trailing window
const RECENT_MIN_POINTS    = 3;     // a slope needs 3 points to carry a CI
const RECENT_MIN_SPAN_DAYS = 90;    // 3 draws in a fortnight is not a trend

/**
 * Split the fittable measurements into { points: recent, earlier }, or null
 * when the series can't support the comparison. Prefers a trailing 12 months,
 * widens when that holds too few points or too short a span, and requires the
 * window to leave enough earlier points behind to compare against.
 */
function recentWindow(data) {
  // Collapsed, so the window and the fit reason over the same observations.
  const pts = collapseSameDay(fittablePoints(data), 'geometric');
  if (pts.length < RECENT_MIN_POINTS + 1) return null;

  const lastMs   = pts[pts.length - 1].date.getTime();
  const inWindow = ms => (lastMs - ms) <= RECENT_WINDOW_DAYS * MS_PER_DAY;
  const spanOk   = i  => (lastMs - pts[i].date.getTime()) >= RECENT_MIN_SPAN_DAYS * MS_PER_DAY;

  let start = pts.findIndex(d => inWindow(d.date.getTime()));
  if (start === -1) start = pts.length - 1;

  // Widen backwards until the window holds enough points across enough time.
  while (start > 0 && (pts.length - start < RECENT_MIN_POINTS || !spanOk(start))) start--;

  // start === 0 means the window ate the whole series: nothing left to compare.
  if (start === 0) return null;
  if (pts.length - start < RECENT_MIN_POINTS || !spanOk(start)) return null;

  return { points: pts.slice(start), earlier: pts.slice(0, start) };
}

/**
 * Compare the exponential rate constant B between the recent window and the
 * earlier points. The two sets are disjoint, so Var(difference) is the sum of
 * variances — comparing recent against the OVERALL fit would double-count the
 * shared points and overstate the difference.
 *
 * Returns { differs, direction } or null when either side can't carry a CI
 * (n < 3 leaves no residual degrees of freedom, so varB would be a fake zero).
 */
function compareTrend(recentFit, earlierFit) {
  if (!recentFit || !earlierFit) return null;
  if (!recentFit.ciEstimable || !earlierFit.ciEstimable) return null;

  const se = Math.sqrt(recentFit.varB + earlierFit.varB);
  if (!isFinite(se) || se <= 0) return null;

  const diff = recentFit.B - earlierFit.B;
  const df   = (recentFit.n - 2) + (earlierFit.n - 2);
  return {
    differs: Math.abs(diff / se) > tValue95(df),
    // "rate constant increased" stays true whether the series is rising faster
    // or falling more slowly; "faster growth" would be wrong in the latter.
    direction: diff > 0 ? 'increased' : 'decreased'
  };
}

// Assay + biological noise floor. Biological variation alone runs ~7.3% CV
// (95th percentile 19.2%), and assay CV commonly exceeds 20% below 0.4 ng/mL,
// so a change between draws under ~20-46% can be entirely noise. 1.2x is the
// conservative end of that band: series that move less get a caution instead
// of a confident doubling time.
const PSA_NOISE_FOLD     = 1.2;
const ULTRASENSITIVE_MAX = 0.1;

function medianOf(nums) {
  const s = nums.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * The single most important caveat about reading this series, or null. Capped
 * at one message on purpose — a stack of hedges reads as noise and gets
 * skipped, which defeats the point of hedging at all.
 */
function noiseCaveat(data) {
  const pts = fittablePoints(data);
  if (pts.length < 2) return null;

  const first = pts[0].psaValue;
  const last  = pts[pts.length - 1].psaValue;
  const fold  = Math.max(last / first, first / last);
  if (isFinite(fold) && fold < PSA_NOISE_FOLD) {
    return 'Total change across these measurements is under ' +
      Math.round((PSA_NOISE_FOLD - 1) * 100) + '%, which assay and biological ' +
      'variation alone can produce. Treat the doubling time as provisional.';
  }

  if (medianOf(pts.map(d => d.psaValue)) < ULTRASENSITIVE_MAX) {
    return 'At ultrasensitive levels (below ' + ULTRASENSITIVE_MAX + ' ng/mL) assay ' +
      'variation commonly exceeds 20%, so these values scatter more than the fit ' +
      'assumes. The doubling time is correspondingly less certain.';
  }

  return null;
}

// -------------------------------------------------------------------------
// Chart
// -------------------------------------------------------------------------

let psaChart  = null;
let whiteMode = false;
let lastData  = null;
let lastFit   = null;
let recentFit = null;          // recent-window fit, drawn as a comparison line
let defaultProjectionYears = 2;
let yAxisType = 'linear';      // 'linear' (capped) | 'logarithmic'
let lastDataMs = null;         // last measured date — projection-shading divider

function fmtDate(date) {
  return date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
}

/**
 * Format a COMPUTED PSA value with precision scaled to its magnitude — fitted
 * curves, projections, velocity. Measurements are echoed via psaText instead
 * (see fmtPsaCell); this rounding is only for model outputs, where extra
 * decimals would be false precision. Ultrasensitive assays (post-prostatectomy)
 * report to 3+ decimals — 0.008, 0.014 — and a fixed 2-decimal display
 * collapsed all of those to "0.00". Anything below the 0.1 ng/mL
 * "undetectable" threshold therefore gets 3 decimals; below 0.001 we fall
 * back to 2 significant figures so a very low value never prints as zero.
 */
function fmtPsa(v) {
  if (v == null || !isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a === 0)     return '0.00';
  if (a < 0.001)   return v.toPrecision(2);
  if (a < 0.1)     return v.toFixed(3);
  return v.toFixed(2);
}

// One measurement as a table cell, echoed at the precision it was entered —
// the table exists to confirm parsing, and re-rounding an entered "0.154" to
// "0.15" misreports the number the fit actually uses. Below-detection rows
// keep their "<" so the row never reads as a measured concentration.
function fmtPsaCell(d) {
  return (d.censored ? '< ' : '') + (d.psaText || fmtPsa(d.psaValue));
}

/**
 * Date where the fitted curve stops being supported by data — the last point
 * the fit actually used. The chart shades everything after it as extrapolation,
 * so a trailing row the fit ignored (below-detection, or PSA ≤ 0) must not push
 * that divider right and pass extrapolation off as measured. Falls back to the
 * last row when nothing was fittable.
 */
function lastFittedDateMs(data) {
  for (let i = data.length - 1; i >= 0; i--) {
    if (!data[i].censored && data[i].psaValue > 0) return data[i].date.getTime();
  }
  return data[data.length - 1].date.getTime();
}

// A "doubling time" longer than a human lifetime is, clinically, no trend at all
// (and catches B≈0 floating-point noise that would otherwise print absurd values).
const DT_STABLE_DAYS = 100 * 365.25;

function fmtDoublingTime(days) {
  if (!isFinite(days) || Math.abs(days) > DT_STABLE_DAYS) {
    return `PSA stable (no measurable trend)`;
  }
  if (days < 0)   return `PSA is decreasing (rate constant implies halving, not doubling)`;
  if (days < 60)  return `${days.toFixed(1)} days`;
  if (days < 730) return `${(days / 30.44).toFixed(1)} months`;
  return `${(days / 365.25).toFixed(2)} years  (${(days / 30.44).toFixed(1)} months)`;
}

// Compact one-unit duration for CI bounds (no dual unit, pairs cleanly in a range).
function fmtDurationShort(days) {
  const a = Math.abs(days);
  if (a < 60)  return `${days.toFixed(0)} d`;
  if (a < 730) return `${(days / 30.44).toFixed(1)} mo`;
  return `${(days / 365.25).toFixed(1)} yr`;
}

// Human text for the doubling-time 95% CI (see doublingTimeCI).
// For a decreasing series the bounds are negative half-life days; show them as
// positive halving times ordered small→large so the range reads naturally.
function fmtDoublingTimeCI(ci) {
  if (!ci || !ci.estimable) {
    if (ci && ci.reason === 'need3') return '95% CI: needs ≥3 measurements';
    return '95% CI: not estimable (trend not significant)';   // spanszero / degenerate
  }
  if (ci.increasing) {
    return `95% CI ${fmtDurationShort(ci.loDays)} – ${fmtDurationShort(ci.hiDays)}`;
  }
  const a = Math.abs(ci.loDays), b = Math.abs(ci.hiDays);
  const lo = Math.min(a, b), hi = Math.max(a, b);
  return `95% CI (halving) ${fmtDurationShort(lo)} – ${fmtDurationShort(hi)}`;
}

function fmtRSquared(fit) {
  if (!fit || !fit.rSquaredDefined) return 'R² n/a';
  return `R² ${fit.rSquared.toFixed(2)} (log fit)`;
}

function fmtVelocity(v) {
  if (v == null || !isFinite(v)) return 'velocity n/a';
  const sign = v >= 0 ? '+' : '';
  return `velocity ${sign}${fmtPsa(v)} ng/mL/yr`;
}

// Set textContent if the element exists (no-op under the test DOM shim).
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// Grow the PSA input textarea to fit its content (down to a floor, up to a cap,
// then it scrolls) so pasting many measurements doesn't cram into a tiny box.
function autoGrowPsaInput(el) {
  el = el || document.getElementById('psaInput');
  if (!el || el.scrollHeight == null) return;   // no-op under the test DOM shim
  el.style.height = 'auto';
  el.style.height = Math.min(460, Math.max(130, el.scrollHeight + 2)) + 'px';
}

/**
 * Generate weekly points along the fitted curve from startDate to endDate.
 * Also returns upper and lower 95% confidence bands when variance info is
 * available (n >= 3).
 */
function buildCurve(fit, startDate, endDate) {
  const STEP = 7 * MS_PER_DAY;
  const pts   = [];
  const upper = [];
  const lower = [];

  // t-distribution critical value for 95% CI (two-tailed)
  const tCrit = tValue95(fit.n - 2);
  const hasBands = fit.n >= 3 && fit.varLnA != null;

  let t = startDate.getTime();
  const end = endDate.getTime();
  while (t <= end) {
    const dx  = (t - fit.firstDate.getTime()) / MS_PER_DAY;
    const psa = fit.A * Math.exp(fit.B * dx);
    pts.push({ x: new Date(t), y: psa });

    if (hasBands) {
      // Variance of ln(ŷ) = Var(lnA) + dx² * Var(B) + 2*dx*Cov(lnA,B)
      const varLnY = fit.varLnA + dx * dx * fit.varB + 2 * dx * fit.covAB;
      const se = Math.sqrt(Math.max(0, varLnY));
      upper.push({ x: new Date(t), y: psa * Math.exp(tCrit * se) });
      lower.push({ x: new Date(t), y: psa * Math.exp(-tCrit * se) });
    }

    t += STEP;
  }
  return { pts, upper, lower, hasBands };
}

/**
 * Approximate two-tailed t critical value at 95% for given degrees of freedom.
 * Uses a small lookup + linear interpolation; accurate enough for CI bands.
 */
function tValue95(df) {
  if (df <= 0) return 12.706;
  const table = [
    [1, 12.706], [2, 4.303], [3, 3.182], [4, 2.776], [5, 2.571],
    [6, 2.447], [7, 2.365], [8, 2.306], [9, 2.262], [10, 2.228],
    [15, 2.131], [20, 2.086], [30, 2.042], [60, 2.000], [120, 1.980],
    [Infinity, 1.960]
  ];
  for (let i = 0; i < table.length; i++) {
    if (df <= table[i][0]) {
      if (i === 0) return table[0][1];
      const [d0, t0] = table[i - 1];
      const [d1, t1] = table[i];
      const frac = (df - d0) / (d1 - d0);
      return t0 + frac * (t1 - t0);
    }
  }
  return 1.96;
}

function isLightTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light';
}

function renderChart(data, fit) {
  const light       = whiteMode || isLightTheme();
  const bgColor     = light ? '#ffffff' : '#1a1a1a';
  const gridColor   = light ? '#ddd'    : '#2e2e2e';
  const tickColor   = light ? '#444'    : '#777';
  const legendColor = light ? '#333'    : '#bbb';
  const titleColor  = light ? '#444'    : '#777';

  const MS_PER_YEAR = 365.25 * MS_PER_DAY;
  // Clamp to [0.5, 30] yr: buildCurve steps weekly, so an unbounded value (e.g.
  // a hand-edited URL/history param) would generate millions of points and hang.
  let projYrs = parseFloat(document.getElementById('projectionYears').value);
  if (!isFinite(projYrs)) projYrs = defaultProjectionYears;
  projYrs = Math.max(0.5, Math.min(30, projYrs));
  const chartStart  = new Date(data[0].date);
  const chartEnd    = new Date(data[data.length - 1].date.getTime() + projYrs * MS_PER_YEAR);

  const { pts: curve, upper, lower, hasBands } = buildCurve(fit, chartStart, chartEnd);
  // Below-detection results are plotted at their reported limit, as a separate
  // series, so the row in the table has a visible counterpart on the chart
  // without being mistaken for a measured point.
  const measured = data.filter(d => !d.censored).map(d => ({ x: new Date(d.date), y: d.psaValue }));
  const censored = data.filter(d =>  d.censored).map(d => ({ x: new Date(d.date), y: d.psaValue }));

  // Projection-region divider, used by the shading plugin.
  lastDataMs = lastFittedDateMs(data);

  // Linear axis cap: the CI band grows exponentially into the projection and
  // would otherwise force autoscale to a huge max, crushing the data. Cap to
  // 1.5x the largest *finite, positive* value over the WHOLE sampled curve plus
  // measured points (not just fit-at-end — a decreasing fit peaks at the start).
  let yMax = null;
  if (yAxisType === 'linear') {
    let m = 0;
    for (const p of measured) if (isFinite(p.y) && p.y > 0) m = Math.max(m, p.y);
    for (const p of censored) if (isFinite(p.y) && p.y > 0) m = Math.max(m, p.y);
    for (const p of curve)    if (isFinite(p.y) && p.y > 0) m = Math.max(m, p.y);
    if (m > 0 && isFinite(m)) yMax = m * 1.5;
  }
  const isLog = yAxisType === 'logarithmic';

  if (psaChart) { psaChart.destroy(); psaChart = null; }

  const ctx = document.getElementById('psaChart').getContext('2d');

  const datasets = [
    {
      label: 'Measured PSA',
      data: measured,
      backgroundColor: '#4fc3f7',
      borderColor: '#4fc3f7',
      pointStyle: 'circle',
      pointRadius: 6,
      pointHoverRadius: 9,
      order: 1
    },
    {
      label: 'Exponential Fit',
      data: curve,
      type: 'line',
      borderColor: '#ef5350',
      backgroundColor: 'rgba(239,83,80,0.08)',
      fill: false,
      pointStyle: 'line',   // legend swatch renders as a line, not a box
      pointRadius: 0,
      pointHitRadius: 10,
      borderWidth: 2.5,
      tension: 0,
      order: 2
    }
  ];

  // Recent-trend line: no CI band of its own — it is a comparison aid against
  // the main fit, not a second fit with its own uncertainty story to tell.
  if (recentFit) {
    datasets.push({
      label: 'Recent trend',
      data: buildCurve(recentFit, new Date(recentFit.firstDate), chartEnd).pts,
      type: 'line',
      borderColor: '#ffb74d',
      backgroundColor: 'transparent',
      fill: false,
      pointStyle: 'line',
      pointRadius: 0,
      pointHitRadius: 0,
      borderWidth: 2,
      borderDash: [6, 3],
      tension: 0,
      order: 5
    });
  }

  if (censored.length) {
    // Down-pointing marker at the detection limit: the true value lies below it.
    datasets.splice(1, 0, {
      label: 'Below detection',
      data: censored,
      backgroundColor: light ? 'rgba(0,0,0,0.30)' : 'rgba(255,255,255,0.40)',
      borderColor:     light ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.55)',
      pointStyle: 'triangle',
      pointRotation: 180,
      pointRadius: 6,
      pointHoverRadius: 9,
      order: 1
    });
  }

  if (hasBands) {
    datasets.push({
      label: '95% CI (trend)',
      data: upper,
      type: 'line',
      borderColor: 'rgba(239,83,80,0.3)',
      backgroundColor: 'rgba(239,83,80,0.10)',
      fill: '+1',   // fill between this dataset and the next (lower)
      pointStyle: 'rectRot',
      pointRadius: 0,
      pointHitRadius: 0,
      borderWidth: 1,
      borderDash: [4, 4],
      tension: 0,
      order: 3
    });
    datasets.push({
      label: '95% CI Lower',
      data: lower,
      type: 'line',
      borderColor: 'rgba(239,83,80,0.3)',
      backgroundColor: 'transparent',
      fill: false,
      pointRadius: 0,
      pointHitRadius: 0,
      borderWidth: 1,
      borderDash: [4, 4],
      tension: 0,
      order: 4
    });
  }

  const yScale = isLog
    ? {
        type: 'logarithmic',
        ticks: { color: tickColor },
        grid:  { color: gridColor },
        title: { display: true, text: 'PSA (ng/mL, log scale)', color: titleColor }
      }
    : {
        type: 'linear',
        beginAtZero: true,
        max: yMax != null ? yMax : undefined,
        ticks: { color: tickColor },
        grid:  { color: gridColor },
        title: { display: true, text: 'PSA (ng/mL)', color: titleColor }
      };

  psaChart = new Chart(ctx, {
    type: 'scatter',
    data: { datasets },
    options: {
      responsive: true,
      // A fixed 2:1 ratio left ~100px of plot on a phone, collapsing every
      // point onto one line. The wrapper owns the height instead.
      maintainAspectRatio: false,
      animation: { duration: 400 },
      plugins: {
        tooltip: { enabled: false },
        legend: {
          labels: {
            color: legendColor,
            padding: 16,
            usePointStyle: true,
            filter: item => item.text !== '95% CI Lower'
          },
          onClick: function(evt, legendItem, legend) {
            const ci = legendItem.text === '95% CI (trend)';
            Chart.defaults.plugins.legend.onClick.call(this, evt, legendItem, legend);
            if (ci) {
              // Also toggle the hidden CI Lower dataset
              const chart = legend.chart;
              const lowerIdx = chart.data.datasets.findIndex(d => d.label === '95% CI Lower');
              if (lowerIdx !== -1) {
                chart.getDatasetMeta(lowerIdx).hidden = chart.getDatasetMeta(legendItem.datasetIndex).hidden;
                chart.update();
              }
            }
          }
        }
      },
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'month',
            displayFormats: { month: 'MMM yyyy' }
          },
          ticks: { color: tickColor, maxTicksLimit: 10 },
          grid:  { color: gridColor },
          title: { display: true, text: 'Date', color: titleColor }
        },
        y: yScale
      },
      onHover: (evt) => handleChartHover(evt, fit),
      onClick: (evt) => handleChartClick(evt, fit)
    },
    plugins: [{
      id: 'chartBackground',
      beforeDraw(chart) {
        const c2 = chart.canvas.getContext('2d');
        c2.save();
        c2.fillStyle = bgColor;
        c2.fillRect(0, 0, chart.width, chart.height);
        c2.restore();
      },
      // Shade the projection region (last measured date → end) so users can
      // tell measured data from extrapolation. Drawn behind the datasets.
      beforeDatasetsDraw(chart) {
        if (lastDataMs == null) return;
        const area = chart.chartArea;
        const xPix = chart.scales.x.getPixelForValue(lastDataMs);
        if (!isFinite(xPix) || xPix >= area.right - 1) return;
        const left = Math.max(xPix, area.left);
        const c2 = chart.canvas.getContext('2d');
        c2.save();
        c2.fillStyle = light ? 'rgba(0,0,0,0.045)' : 'rgba(255,255,255,0.05)';
        c2.fillRect(left, area.top, area.right - left, area.bottom - area.top);
        c2.restore();
      },
      afterDraw(chart) {
        const c2 = chart.canvas.getContext('2d');
        const area = chart.chartArea;

        // "Projected" label + divider at the measured/extrapolated boundary.
        if (lastDataMs != null) {
          const xPix = chart.scales.x.getPixelForValue(lastDataMs);
          if (isFinite(xPix) && xPix < area.right - 1 && xPix > area.left) {
            c2.save();
            c2.strokeStyle = light ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.22)';
            c2.lineWidth = 1;
            c2.setLineDash([3, 3]);
            c2.beginPath();
            c2.moveTo(xPix, area.top);
            c2.lineTo(xPix, area.bottom);
            c2.stroke();
            c2.setLineDash([]);
            const lblSize = Math.max(9, Math.round(chart.width / 90));
            c2.font = `${lblSize}px system-ui, sans-serif`;
            c2.fillStyle = light ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.45)';
            c2.textAlign = 'left';
            c2.textBaseline = 'top';
            c2.fillText('Projected →', xPix + 5, area.top + 4);
            c2.restore();
          }
        }

        // Watermark, bottom-right.
        c2.save();
        const fontSize = Math.max(10, Math.round(chart.width / 72));
        c2.font = `${fontSize}px system-ui, sans-serif`;
        c2.fillStyle = light ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.16)';
        c2.textAlign = 'right';
        c2.textBaseline = 'bottom';
        c2.fillText('oncologytoolkit.com', area.right, chart.height - 6);
        c2.restore();
      }
    }]
  });
}

// Flip the y-axis between capped-linear and logarithmic, then re-render.
function toggleAxisScale() {
  yAxisType = yAxisType === 'linear' ? 'logarithmic' : 'linear';
  const btn = document.getElementById('axisToggleBtn');
  if (btn) {
    btn.textContent = yAxisType === 'linear' ? 'Log scale' : 'Linear scale';
    btn.setAttribute('aria-label',
      yAxisType === 'linear' ? 'Switch chart to logarithmic y-axis' : 'Switch chart to linear y-axis');
  }
  if (lastData && lastFit) renderChart(lastData, lastFit);
}

// How close the cursor must be to claim it is pointing at something, in px.
const HOVER_POINT_TOL = 14;   // a plotted measurement
const HOVER_CURVE_TOL = 30;   // a drawn curve

/** Nearest candidate within tolerance, or null. Pure — takes {dist} objects. */
function pickNearest(candidates, tol) {
  let best = null;
  for (const c of candidates) {
    if (!c || !isFinite(c.dist) || c.dist > tol) continue;
    if (!best || c.dist < best.dist) best = c;
  }
  return best;
}

/** One readout line. The label is not optional: see hoverTarget. Measurement
 *  targets carry psaText and are echoed as entered; curve readouts round. */
function fmtReadout(t) {
  return t.label + ': ' + (t.censored ? '< ' : '') + (t.psaText || fmtPsa(t.psa)) + ' ng/mL';
}

/**
 * What the cursor is actually pointing at: the nearest plotted measurement, the
 * fitted curve, or the recent-trend line. Measurements win when the cursor is
 * basically on one, since a plotted point is a fact and a curve is a model.
 *
 * With two curves drawn, an UNLABELLED readout is worse than none — the cursor
 * can sit on the recent-trend line while the number quietly comes from the
 * fitted one. Every result carries the name of the thing it came from.
 */
function hoverTarget(pos, fit) {
  if (!psaChart) return null;
  const xs = psaChart.scales.x, ys = psaChart.scales.y;
  const xMs = xs.getValueForPixel(pos.x);
  if (xMs == null || !isFinite(xMs)) return null;

  const points = [];
  if (lastData) {
    for (const d of lastData) {
      const px = xs.getPixelForValue(d.date.getTime());
      const py = ys.getPixelForValue(d.psaValue);
      if (!isFinite(px) || !isFinite(py)) continue;
      points.push({
        dist: Math.sqrt((pos.x - px) * (pos.x - px) + (pos.y - py) * (pos.y - py)),
        label: d.censored ? 'Below detection' : 'Measured',
        date: d.date, psa: d.psaValue, psaText: d.psaText, censored: d.censored, y: py
      });
    }
  }
  const onPoint = pickNearest(points, HOVER_POINT_TOL);
  if (onPoint) return onPoint;

  const curveAt = (f, label) => {
    if (!f) return null;
    const psa = f.A * Math.exp(f.B * (xMs - f.firstDate.getTime()) / MS_PER_DAY);
    if (!isFinite(psa)) return null;
    const py = ys.getPixelForValue(psa);
    if (!isFinite(py)) return null;
    return { dist: Math.abs(pos.y - py), label: label, date: new Date(xMs), psa: psa, y: py };
  };
  return pickNearest([curveAt(fit, 'Fitted trend'), curveAt(recentFit, 'Recent trend')],
                     HOVER_CURVE_TOL);
}

/**
 * On hover, report whatever the cursor is over — a measurement, the fitted
 * curve, or the recent-trend line — labelled with which one it is.
 */
function handleChartHover(evt, fit) {
  if (!psaChart) return;
  const tooltip = getCustomTooltip();
  const pos = Chart.helpers.getRelativePosition(evt, psaChart);
  const area = psaChart.chartArea;

  if (pos.x < area.left || pos.x > area.right || pos.y < area.top || pos.y > area.bottom) {
    tooltip.style.display = 'none';
    return;
  }

  const target = hoverTarget(pos, fit);
  if (!target) { tooltip.style.display = 'none'; return; }

  tooltip.innerHTML = '<strong>' + fmtDate(target.date) + '</strong><br>' + fmtReadout(target);
  tooltip.style.display = 'block';

  // Position relative to the canvas
  const canvasRect = psaChart.canvas.getBoundingClientRect();
  const tipX = canvasRect.left + window.scrollX + pos.x + 14;
  const tipY = canvasRect.top + window.scrollY + target.y - 20;
  tooltip.style.left = tipX + 'px';
  tooltip.style.top  = tipY + 'px';
}

/** Create or retrieve the custom floating tooltip element. */
function getCustomTooltip() {
  let el = document.getElementById('psaFitTooltip');
  var light = whiteMode || isLightTheme();
  if (!el) {
    el = document.createElement('div');
    el.id = 'psaFitTooltip';
    el.style.cssText = 'position:absolute;pointer-events:none;padding:6px 10px;' +
      'border-radius:6px;font-size:13px;line-height:1.4;z-index:100;' +
      'white-space:nowrap;display:none;';
    document.body.appendChild(el);
  }
  if (light) {
    el.style.background = 'rgba(255,255,255,0.95)';
    el.style.color = '#111';
    el.style.border = '1px solid rgba(0,0,0,0.12)';
  } else {
    el.style.background = 'rgba(30,30,30,0.92)';
    el.style.color = '#eee';
    el.style.border = '1px solid rgba(255,255,255,0.15)';
  }
  return el;
}

/**
 * On click, compute the expected PSA from the fit curve
 * at the clicked x position and display it in the info box.
 */
function handleChartClick(evt, fit) {
  if (!psaChart) return;

  const pos = Chart.helpers.getRelativePosition(evt, psaChart);
  // Tapping away from every line still answers "what does the fit say here?",
  // which is the point of the readout — but it says which line it read.
  const target = hoverTarget(pos, fit) || (function () {
    const xMs = psaChart.scales.x.getValueForPixel(pos.x);
    if (xMs == null || !isFinite(xMs)) return null;
    const psa = fit.A * Math.exp(fit.B * (xMs - fit.firstDate.getTime()) / MS_PER_DAY);
    return isFinite(psa)
      ? { label: 'Fitted trend', date: new Date(xMs), psa: psa, censored: false }
      : null;
  })();
  if (!target) return;

  const el = document.getElementById('clickInfo');
  el.innerHTML = '<strong>' + fmtDate(target.date) + '</strong> &nbsp;&rarr;&nbsp; ' +
    target.label + ': <strong>' + (target.censored ? '&lt; ' : '') +
    (target.psaText || fmtPsa(target.psa)) + ' ng/mL</strong>';
  el.style.display = 'block';
}

// -------------------------------------------------------------------------
// White background toggle
// -------------------------------------------------------------------------

function toggleWhiteMode() {
  whiteMode = !whiteMode;
  const btn = document.getElementById('whiteModeBtn');
  const res = document.getElementById('psaResults');
  if (whiteMode) {
    res.classList.add('psa-white-mode');
    btn.textContent = 'Dark Background';
  } else {
    res.classList.remove('psa-white-mode');
    btn.textContent = 'White Background';
  }
  if (lastData && lastFit) renderChart(lastData, lastFit);
}

// -------------------------------------------------------------------------
// Copy results as PNG to clipboard
// -------------------------------------------------------------------------

/**
 * Break a string into lines that fit maxWidth in the given ctx's current font.
 * Breaks on spaces so prose reads normally, and falls back to character breaks
 * inside any single run too long to fit — which is how a share URL, with no
 * spaces to break on, still wraps instead of overflowing the sheet.
 */
function wrapTextToWidth(ctx, text, maxWidth) {
  const lines = [];
  let line = '';

  const words = String(text).split(' ');
  for (let w = 0; w < words.length; w++) {
    const word = words[w];
    const candidate = line ? line + ' ' + word : word;

    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) { lines.push(line); line = ''; }

    if (ctx.measureText(word).width <= maxWidth) {
      line = word;
      continue;
    }
    for (let i = 0; i < word.length; i++) {
      const test = line + word[i];
      if (line && ctx.measureText(test).width > maxWidth) {
        lines.push(line);
        line = word[i];
      } else {
        line = test;
      }
    }
  }

  if (line) lines.push(line);
  return lines;
}

function copyResults() {
  if (!lastData || !lastFit) return;
  const btn         = document.getElementById('copyResultsBtn');
  const dt          = document.getElementById('doublingTime').textContent;
  const chartCanvas = document.getElementById('psaChart');

  const font = 'Arial, Helvetica, sans-serif';

  // Secondary readouts (CI, R², velocity, recent trend) for the exported image.
  const ciText     = (document.getElementById('psaCI') || {}).textContent || '';
  const statsText  = (document.getElementById('psaStats') || {}).textContent || '';
  const recentText = (document.getElementById('psaRecent') || {}).textContent || '';

  // The sheet takes its palette from the chart's own mode. A dark chart on a
  // white sheet reads as two documents in one frame — whichever mode the user
  // is in, the exported image has to look like one thing.
  const lightSheet = whiteMode || isLightTheme();
  // `faint` still clears WCAG AA (4.5:1) against its own background — the
  // eyebrow, column heads, and footer are small type, which is exactly where
  // a "just a bit greyer" choice stops being readable.
  const sheet = lightSheet
    ? { bg: '#ffffff', ink: '#111111', muted: '#5a5a63', faint: '#6b6b73',
        rule: 'rgba(0,0,0,0.10)', accent: '#0277bd', trend: '#c77c14' }
    : { bg: '#1a1a1a', ink: '#f2f2f4', muted: '#a8a8b0', faint: '#8f8f99',
        rule: 'rgba(255,255,255,0.12)', accent: '#4fc3f7', trend: '#ffb74d' };

  const pad = 40;
  const gap = 24;
  const W   = chartCanvas.width;
  const contentW = W - pad * 2;

  // Header type scale: one dominant value, everything else clearly subordinate.
  const eyebrowSize = Math.max(10, Math.round(W / 72));
  const valSize     = Math.max(22, Math.round(W / 22));
  const subSize     = Math.max(12, Math.round(W / 56));
  const metaSize    = Math.max(10, Math.round(W / 68));
  const rowH        = Math.max(26, Math.round(W / 26));

  const eyebrowY = pad + eyebrowSize;
  const valueY   = eyebrowY + valSize + 12;
  const ciY      = valueY + subSize + 14;
  const statsY   = ciY + metaSize + 12;
  // The recent-trend line only reserves height when there is one to print.
  const recentY  = recentText ? statsY + metaSize + 11 : statsY;

  // The caveats travel with the image. A note that only exists on screen never
  // reaches whoever is handed the PNG, which would leave the exported number
  // stated more confidently than the page states it.
  const measureCtx = document.createElement('canvas').getContext('2d');
  measureCtx.font = `${metaSize}px ${font}`;
  const noteLineH = metaSize + 7;
  const noteLines = ['psaNoiseNote', 'psaCensoredNote', 'psaDropNote', 'psaUnparsedNote', 'psaSameDayNote']
    .map(id => document.getElementById(id))
    .filter(el => el && el.style.display !== 'none' && el.textContent)
    .reduce((acc, el) => acc.concat(wrapTextToWidth(measureCtx, el.textContent, contentW)), []);

  const notesY = recentY + (noteLines.length ? 14 : 0);
  const headH  = notesY + noteLines.length * noteLineH + 22;

  // Shareable link — the same URL the "Copy Link" button produces — so the
  // image can be reopened later to add more measurements. Wrapped to fit width.
  const shareUrl = window.location.origin + window.location.pathname + '?' +
    new URLSearchParams(PSA_INPUT_IDS.reduce(function (acc, id) {
      const el = document.getElementById(id);
      if (el && el.value !== '') acc[id] = el.value;
      return acc;
    }, {})).toString();

  const urlSize   = Math.max(10, Math.round(W / 86));
  const urlLineH  = urlSize + 5;
  measureCtx.font = urlSize + 'px monospace';
  const urlLines = wrapTextToWidth(measureCtx, shareUrl, contentW);
  const footerH  = gap + (metaSize + 10) + urlLines.length * urlLineH + pad;

  // The chart is inset to the sheet's margin instead of bleeding to the edges,
  // so the figure sits inside the document rather than punching through it.
  const chartH = Math.round(chartCanvas.height * (contentW / chartCanvas.width));
  const chartY = headH + gap;

  const tableH = (lastData.length + 2) * rowH + gap * 2;
  const H      = chartY + chartH + tableH + footerH;

  const out = document.createElement('canvas');
  out.width  = W;
  out.height = H;
  const c = out.getContext('2d');

  c.fillStyle = sheet.bg;
  c.fillRect(0, 0, W, H);

  // Letter-spaced small caps for the eyebrow + column heads. Not in every
  // engine, so set it defensively and always clear it again.
  const setTracking = px => { if ('letterSpacing' in c) c.letterSpacing = px; };

  // Eyebrow: names the figure without competing with the number it labels.
  setTracking('1.4px');
  c.fillStyle = sheet.faint;
  c.font = `bold ${eyebrowSize}px ${font}`;
  c.fillText('PSA DOUBLING TIME', pad, eyebrowY);
  setTracking('0px');

  // The headline: the one thing this image exists to communicate.
  c.fillStyle = sheet.accent;
  c.font = `bold ${valSize}px ${font}`;
  c.fillText(dt, pad, valueY);

  c.fillStyle = sheet.muted;
  c.font = `${subSize}px ${font}`;
  if (ciText) c.fillText(ciText, pad, ciY);

  c.font = `${metaSize}px ${font}`;
  c.fillStyle = sheet.faint;
  if (statsText) c.fillText(statsText, pad, statsY);

  // Recent trend carries a dash swatch in the chart line's own colour, so the
  // sentence and the line on the chart read as the same claim.
  if (recentText) {
    const dashW = Math.round(metaSize * 1.6);
    c.strokeStyle = sheet.trend;
    c.lineWidth = 2;
    c.setLineDash([4, 3]);
    c.beginPath();
    c.moveTo(pad, recentY - metaSize * 0.32);
    c.lineTo(pad + dashW, recentY - metaSize * 0.32);
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = sheet.muted;
    c.fillText(recentText, pad + dashW + 8, recentY);
  }

  c.fillStyle = sheet.faint;
  c.font = `${metaSize}px ${font}`;
  for (let i = 0; i < noteLines.length; i++) {
    c.fillText(noteLines[i], pad, notesY + (i + 1) * noteLineH);
  }

  // Hairline between the masthead and the figure.
  c.fillStyle = sheet.rule;
  c.fillRect(pad, headH - 12, contentW, 1);

  c.drawImage(chartCanvas, pad, chartY, contentW, chartH);

  // Table: date left, value right — the numeric column gets a hard right edge
  // so the digits line up as a column instead of ragging against the dates.
  let y = chartY + chartH + gap + rowH;
  const tSize = Math.max(13, Math.round(W / 50));
  const rightX = W - pad;

  setTracking('1.2px');
  c.fillStyle = sheet.faint;
  c.font = `bold ${eyebrowSize}px ${font}`;
  c.fillText('DATE', pad, y);
  c.textAlign = 'right';
  c.fillText('PSA (NG/ML)', rightX, y);
  c.textAlign = 'left';
  setTracking('0px');

  y += 12;
  c.fillStyle = sheet.rule;
  c.fillRect(pad, y, contentW, 1);
  y += rowH;

  for (let i = 0; i < lastData.length; i++) {
    const d = lastData[i];
    const italic = d.censored ? 'italic ' : '';

    c.fillStyle = sheet.muted;
    c.font = `${italic}${tSize}px ${font}`;
    c.fillText(fmtDate(d.date), pad, y);

    c.fillStyle = sheet.ink;
    c.textAlign = 'right';
    c.fillText(fmtPsaCell(d), rightX, y);
    c.textAlign = 'left';

    if (i < lastData.length - 1) {
      c.fillStyle = sheet.rule;
      c.fillRect(pad, y + Math.round(rowH * 0.3), contentW, 1);
    }
    y += rowH;
  }

  // Footer: when it was made, then how to reopen it. The chart carries the
  // wordmark already, so this doesn't repeat the domain as a headline.
  y += gap;
  c.fillStyle = sheet.faint;
  c.font = `${metaSize}px ${font}`;
  c.fillText('Generated ' + fmtDate(new Date()) + '  ·  reopen or add measurements:', pad, y);
  y += metaSize + 10;
  c.font = `${urlSize}px monospace`;
  for (let i = 0; i < urlLines.length; i++) {
    c.fillText(urlLines[i], pad, y);
    y += urlLineH;
  }

  out.toBlob(function (blob) {
    navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(function () {
      const orig = btn.textContent;
      btn.textContent = '\u2713 Copied!';
      setTimeout(function () { btn.textContent = orig; }, 1500);
    }).catch(function () {
      const a = document.createElement('a');
      a.href = out.toDataURL();
      a.download = 'psa-results.png';
      a.click();
    });
  });
}

// -------------------------------------------------------------------------
// Parsed data table
// -------------------------------------------------------------------------

function updateParsedTable(data) {
  const table = document.getElementById('parsedTable');
  while (table.rows.length > 1) table.deleteRow(-1);
  for (const d of data) {
    const row = table.insertRow(-1);
    row.insertCell(0).textContent = fmtDate(d.date);
    const valCell = row.insertCell(1);
    valCell.textContent = fmtPsaCell(d);
    // Below-detection rows stay listed but read as excluded, not measured.
    if (d.censored) {
      row.className = 'psa-row-censored';
      valCell.title = 'Below the assay detection limit — listed but excluded from the fit';
    }
  }
}

// -------------------------------------------------------------------------
// History + shareable link
//
// PSA's "input" is the whole textarea (psaInput) plus projectionYears, so the
// history params carry the full dataset and round-trip through the URL. The
// computed doubling time / measurement count / date span are stored as extra
// params (psa-dt / psa-n / psa-span) so the recents label and the hub pill can
// show them without re-running the fit (which isn't available on the hub).
// saveToHistory / renderHistory / serializeToUrl / setupCopyLinkButton come
// from history.js + url-state.js (loaded before psa.js).
// -------------------------------------------------------------------------

var PSA_INPUT_IDS = ['psaInput', 'projectionYears'];

function psaShortDt(days) {
  if (!isFinite(days) || Math.abs(days) > DT_STABLE_DAYS) return 'stable';
  if (days < 0)   return 'decreasing';
  if (days < 60)  return days.toFixed(0) + ' d';
  if (days < 730) return (days / 30.44).toFixed(1) + ' mo';
  return (days / 365.25).toFixed(1) + ' yr';
}

function psaSpanLabel(data) {
  function ym(d) { return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); }
  var a = ym(data[0].date), b = ym(data[data.length - 1].date);
  return a === b ? a : a + ' – ' + b;
}

function savePsaHistory(data, fit) {
  saveToHistory('psa', PSA_INPUT_IDS, {
    'psa-dt': psaShortDt(fit.doublingTimeDays),
    'psa-n': String(data.length),
    'psa-span': psaSpanLabel(data)
  });
  renderHistory('psa', PSA_INPUT_IDS, calculate, psaSummary, restorePsaEntry);
}

// Recall a saved entry: refill textarea + projection, recompute keeping the
// saved projection, then point the URL at the recalled dataset.
function restorePsaEntry(params) {
  document.getElementById('psaInput').value = params['psaInput'] || '';
  var hasPy = params['projectionYears'] !== undefined && params['projectionYears'] !== '';
  if (hasPy) document.getElementById('projectionYears').value = params['projectionYears'];
  calculate(hasPy);
  window.history.replaceState(null, '', serializeToUrl(PSA_INPUT_IDS));
}

// On load, reconstruct from ?psaInput=...&projectionYears=... (shared link or
// hub recents pill). parseUrlParams can't be reused — it drops non-numeric
// values like the textarea text.
function initPsaFromUrl() {
  var sp = new URLSearchParams(window.location.search);
  var text = sp.get('psaInput');
  if (text === null) return;
  document.getElementById('psaInput').value = text;
  var py = sp.get('projectionYears');
  var hasPy = py !== null && !isNaN(parseFloat(py));
  if (hasPy) document.getElementById('projectionYears').value = py;
  calculate(hasPy);
}

// -------------------------------------------------------------------------
// Main entry point
// -------------------------------------------------------------------------

function calculate(keepProjection) {
  const input = document.getElementById('psaInput');
  // Strip blank lines so pasted data with leading/trailing whitespace works
  input.value = input.value.split('\n').filter(l => l.trim()).join('\n');
  const text = input.value;
  autoGrowPsaInput(input);
  const rawData = parseInput(text);
  const data = dedupeMeasurements(rawData);   // hide exact duplicates everywhere
  recentFit = null;                           // never carry a stale trend line forward
  const dupsRemoved = rawData.length - data.length;

  const errEl        = document.getElementById('psaError');
  const resEl        = document.getElementById('psaResults');
  const parsedSecEl  = document.getElementById('parsedSection');

  // Below-detection rows ("<0.014") are listed but never fitted.
  const censoredCount = data.filter(d => d.censored).length;

  // Whatever parsed stays on screen even when it can't be fitted — a run of
  // all-undetectable results is a real (and common) post-prostatectomy case.
  if (data.length) updateParsedTable(data);
  parsedSecEl.style.display = data.length ? 'block' : 'none';

  // Same-day values are averaged into their date for the fit; the table still
  // lists every value as entered, so the two must be reconciled out loud.
  const collapsed = sameDayCollapsedCount(data);
  const sdEl = document.getElementById('psaSameDayNote');
  if (sdEl) {
    if (collapsed > 0) {
      sdEl.textContent = collapsed + ' measurement' + (collapsed === 1 ? '' : 's') +
        ' shared a date with another and ' + (collapsed === 1 ? 'was' : 'were') +
        ' averaged into that date for the fit — same-day draws are repeat reads of ' +
        'one value, not separate points in time. Every value is still listed below.';
      sdEl.style.display = 'block';
    } else {
      sdEl.style.display = 'none';
    }
  }

  // Lines the parser could not read at all. Without this they vanish between
  // the textarea and the table, and the fit quietly covers fewer measurements
  // than the user pasted.
  const unreadable = countUnparsedLines(text);
  const badEl = document.getElementById('psaUnparsedNote');
  if (badEl) {
    if (unreadable > 0) {
      badEl.textContent = unreadable + ' line' + (unreadable === 1 ? '' : 's') +
        ' could not be read and ' + (unreadable === 1 ? 'was' : 'were') +
        ' skipped — check for a missing date or a non-numeric result.';
      badEl.style.display = 'block';
    } else {
      badEl.style.display = 'none';
    }
  }

  if (data.length < 2) {
    errEl.textContent = data.length === 0
      ? 'No valid measurements found. Check that each line has a recognisable date and a numeric PSA value.'
      : 'At least 2 measurements are required to calculate a doubling time.';
    errEl.style.display = 'block';
    resEl.style.display = 'none';
    return;
  }

  errEl.style.display = 'none';

  const fit = fitExponential(data);
  if (!fit) {
    // Name the actual cause: a fit needs 2+ values that are both positive and
    // above the detection limit, and either shortfall can be what's missing.
    const usable = collapseSameDay(fittablePoints(data), 'geometric').length;
    // All on one date is a different failure from "no positive values", and
    // saying the wrong one sends the user looking for a problem they don't have.
    const fittable = fittablePoints(data);
    const oneDate = fittable.length >= 2 &&
      fittable.every(d => d.date.getTime() === fittable[0].date.getTime());

    errEl.textContent = oneDate
      ? 'All measurements are from the same date. A doubling time needs values spread over time.'
      : censoredCount > 0
      ? 'Only ' + usable + ' measurement' + (usable === 1 ? '' : 's') +
        ' can be fitted (2 are needed). ' + censoredCount + ' below-detection value' +
        (censoredCount === 1 ? ' is' : 's are') +
        ' listed in the parsed measurements but excluded from the fit.'
      : 'Could not fit the data. Ensure all PSA values are positive numbers.';
    errEl.style.display = 'block';
    resEl.style.display = 'none';
    return;
  }

  lastData = data;
  lastFit  = fit;

  // Default projection: 50% of the input date range, clamped between 0.5 and 5
  // years. Skipped when restoring (keepProjection) so a recalled/shared
  // projectionYears isn't clobbered by the auto-default.
  if (!keepProjection) {
    const dataSpanMs = data[data.length - 1].date.getTime() - data[0].date.getTime();
    const dataSpanYrs = dataSpanMs / (365.25 * MS_PER_DAY);
    defaultProjectionYears = Math.max(0.5, Math.min(5, Math.round(dataSpanYrs * 0.5 * 2) / 2)); // round to nearest 0.5
    document.getElementById('projectionYears').value = defaultProjectionYears;
  }

  document.getElementById('doublingTime').textContent = fmtDoublingTime(fit.doublingTimeDays);

  // Uncertainty rides with the headline; R²/velocity sit in a muted stat row.
  const ci = doublingTimeCI(fit);
  setText('psaCI', fmtDoublingTimeCI(ci));
  const velocity = psaVelocity(data);
  setText('psaStats', fmtRSquared(fit) + '  ·  ' + fmtVelocity(velocity));

  // Recent trend vs the earlier values. Descriptive only — see recentWindow.
  // Computed before renderChart, which draws recentFit as a comparison line.
  // Shown only when both segments can carry a CI, i.e. the comparison actually
  // resolves. A bare "recent trend" number with no verdict would invite the
  // reader to see acceleration in what may be scatter — the number and the
  // "is this beyond noise?" answer ship together or not at all.
  recentFit = null;
  let recentText = '';
  const win = recentWindow(data);
  if (win) {
    const rFit = fitExponential(win.points);
    const cmp  = compareTrend(rFit, fitExponential(win.earlier));
    if (cmp) {
      recentFit = rFit;
      recentText = 'Recent trend (' + win.points.length + ' values since ' +
        fmtDate(win.points[0].date) + '): ' + psaShortDt(rFit.doublingTimeDays) +
        (cmp.differs
          ? '  ·  growth rate ' + cmp.direction + ' vs the earlier values, beyond measurement noise'
          : '  ·  no measurable difference from the earlier values');
    }
  }
  const recentEl = document.getElementById('psaRecent');
  if (recentEl) {
    recentEl.textContent = recentText;
    recentEl.style.display = recentText ? 'block' : 'none';
  }

  // One caveat at most, about reading this series at all.
  const caveat = noiseCaveat(data);
  const caveatEl = document.getElementById('psaNoiseNote');
  if (caveatEl) {
    caveatEl.textContent = caveat || '';
    caveatEl.style.display = caveat ? 'block' : 'none';
  }

  // Disclose measurements dropped from the fit for being PSA ≤ 0. Counted
  // directly (not as data.length - fit.n) so censored rows, which the note
  // below covers, aren't folded into this message.
  const dropped = data.filter(d => !d.censored && !(d.psaValue > 0)).length;
  const dropEl = document.getElementById('psaDropNote');
  if (dropEl) {
    if (dropped > 0) {
      // Axis-independent wording so it never goes stale when the y-axis is toggled.
      dropEl.textContent = dropped + ' measurement' + (dropped === 1 ? '' : 's') +
        ' with PSA ≤ 0 excluded from the fit (zero cannot be plotted on a log axis).';
      dropEl.style.display = 'block';
    } else {
      dropEl.style.display = 'none';
    }
  }

  // Below-detection rows are listed in the table and plotted at their limit,
  // but the fit never sees them — say so rather than letting the table and the
  // fit quietly disagree about how many measurements were used.
  const censEl = document.getElementById('psaCensoredNote');
  if (censEl) {
    if (censoredCount > 0) {
      censEl.textContent = censoredCount + ' below-detection result' +
        (censoredCount === 1 ? '' : 's') + ' (reported as "<") listed but excluded from ' +
        'the fit — the true value is unknown below the assay limit.';
      censEl.style.display = 'block';
    } else {
      censEl.style.display = 'none';
    }
  }

  // Note hidden exact-duplicate measurements so rows don't vanish silently.
  const dupEl = document.getElementById('psaDupNote');
  if (dupEl) {
    if (dupsRemoved > 0) {
      dupEl.textContent = dupsRemoved + ' duplicate measurement' +
        (dupsRemoved === 1 ? '' : 's') + ' hidden.';
      dupEl.style.display = 'block';
    } else {
      dupEl.style.display = 'none';
    }
  }

  document.getElementById('clickInfo').style.display = 'none';

  resEl.style.display = 'block';
  renderChart(data, fit);

  savePsaHistory(data, fit);
}

// Allow Enter key in textarea to not submit, but Shift+Enter or Ctrl+Enter
// to trigger calculation (optional convenience)
document.getElementById('psaInput').addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    calculate();
  }
});

// Auto-grow the textarea as the user types or pastes measurements.
document.getElementById('psaInput').addEventListener('input', function () {
  autoGrowPsaInput(this);
});

document.getElementById('projectionYears').addEventListener('input', function () {
  if (lastData && lastFit) renderChart(lastData, lastFit);
});

// Persist a changed projection so a recalled entry shows the same chart view
// (doubling time itself is unaffected). 'change' (not 'input') to save on commit.
document.getElementById('projectionYears').addEventListener('change', function () {
  if (lastData && lastFit) savePsaHistory(lastData, lastFit);
});

// Re-render chart when site-wide theme changes
window.addEventListener('themechange', function () {
  if (lastData && lastFit) renderChart(lastData, lastFit);
});

// Shareable link + restore-from-URL (shared link or hub recents pill), then
// render any existing history so recents are clickable before a fresh calc.
setupCopyLinkButton('copy-link-btn', PSA_INPUT_IDS);
initPsaFromUrl();
renderHistory('psa', PSA_INPUT_IDS, calculate, psaSummary, restorePsaEntry);
