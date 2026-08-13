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
function tryParseDate(token) {
  token = token.trim();

  // ISO: YYYY-MM-DD
  let m = token.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return makeDate(+m[1], +m[2], +m[3]);

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

/**
 * Parse one line of input into { date, psaValue } or null.
 * Tokenises by whitespace, commas, semicolons, and pipes.
 * Skips any token that is exactly "PSA" (case-insensitive).
 */
function parseLine(line) {
  line = line.trim();
  if (!line || line.startsWith('#')) return null;

  const tokens = line.split(/[\s,;:|]+/).filter(Boolean);

  let date = null;
  let psaValue = null;

  for (const token of tokens) {
    if (/^psa$/i.test(token)) continue;

    if (date === null) {
      const d = tryParseDate(token);
      if (d !== null) { date = d; continue; }
    }

    if (psaValue === null) {
      const n = parseFloat(token);
      if (isFinite(n) && n >= 0) { psaValue = n; }   // reject NaN AND Infinity (1e309)
    }
  }

  if (date === null || psaValue === null) return null;
  return { date, psaValue };
}

/**
 * Parse the full textarea input, returning an array of { date, psaValue }
 * sorted chronologically.
 */
function parseInput(text) {
  const data = text.split('\n').map(parseLine).filter(Boolean);
  data.sort((a, b) => a.date - b.date);
  return data;
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
    const key = d.date.getTime() + '|' + d.psaValue;
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
function fitExponential(data) {
  const valid = data.filter(d => d.psaValue > 0);
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
 * Uses the same psaValue>0 filtered set as fitExponential for consistency.
 * Returns ng/mL/yr (may be negative = declining), or null if not computable.
 */
function psaVelocity(data) {
  const valid = data.filter(d => d.psaValue > 0);
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
// Chart
// -------------------------------------------------------------------------

let psaChart  = null;
let whiteMode = false;
let lastData  = null;
let lastFit   = null;
let defaultProjectionYears = 2;
let yAxisType = 'linear';      // 'linear' (capped) | 'logarithmic'
let lastDataMs = null;         // last measured date — projection-shading divider

function fmtDate(date) {
  return date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
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
  return `velocity ${sign}${v.toFixed(2)} ng/mL/yr`;
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
  const measured = data.map(d => ({ x: new Date(d.date), y: d.psaValue }));

  // Projection-region divider (last measured date), used by the shading plugin.
  lastDataMs = data[data.length - 1].date.getTime();

  // Linear axis cap: the CI band grows exponentially into the projection and
  // would otherwise force autoscale to a huge max, crushing the data. Cap to
  // 1.5x the largest *finite, positive* value over the WHOLE sampled curve plus
  // measured points (not just fit-at-end — a decreasing fit peaks at the start).
  let yMax = null;
  if (yAxisType === 'linear') {
    let m = 0;
    for (const p of measured) if (isFinite(p.y) && p.y > 0) m = Math.max(m, p.y);
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

/**
 * On hover, show a custom tooltip with the fit-curve PSA when the cursor
 * is near the exponential fit line. The tooltip follows the cursor and
 * snaps its y-value to the fit curve.
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

  const xMs = psaChart.scales.x.getValueForPixel(pos.x);
  if (xMs == null || !isFinite(xMs)) { tooltip.style.display = 'none'; return; }

  const hoverDate = new Date(xMs);
  const dx  = (hoverDate.getTime() - fit.firstDate.getTime()) / MS_PER_DAY;
  const psa = fit.A * Math.exp(fit.B * dx);
  if (!isFinite(psa)) { tooltip.style.display = 'none'; return; }

  // Check if cursor is near the fit line (within 30px vertically)
  const fitYPixel = psaChart.scales.y.getPixelForValue(psa);
  if (!isFinite(fitYPixel) || Math.abs(pos.y - fitYPixel) > 30) {
    tooltip.style.display = 'none';
    return;
  }

  tooltip.innerHTML = '<strong>' + fmtDate(hoverDate) + '</strong><br>PSA: ' + psa.toFixed(2) + ' ng/mL';
  tooltip.style.display = 'block';

  // Position relative to the canvas
  const canvasRect = psaChart.canvas.getBoundingClientRect();
  const tipX = canvasRect.left + window.scrollX + pos.x + 14;
  const tipY = canvasRect.top + window.scrollY + fitYPixel - 20;
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
  const xMs = psaChart.scales.x.getValueForPixel(pos.x);
  if (xMs == null || !isFinite(xMs)) return;

  const clickedDate = new Date(xMs);
  const dx  = (clickedDate.getTime() - fit.firstDate.getTime()) / MS_PER_DAY;
  const psa = fit.A * Math.exp(fit.B * dx);
  if (!isFinite(psa)) return;

  const el = document.getElementById('clickInfo');
  el.innerHTML =
    '<strong>' + fmtDate(clickedDate) + '</strong> &nbsp;&rarr;&nbsp; ' +
    'PSA: <strong>' + psa.toFixed(2) + ' ng/mL</strong>';
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

// Break a string into lines that fit maxWidth in the given ctx's current font.
// Character-based (URLs have no spaces to wrap on).
function wrapTextToWidth(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (let i = 0; i < text.length; i++) {
    const test = line + text[i];
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line);
      line = text[i];
    } else {
      line = test;
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

  // Secondary readouts (CI, R², velocity) for the exported image.
  const ciText    = (document.getElementById('psaCI') || {}).textContent || '';
  const statsText = (document.getElementById('psaStats') || {}).textContent || '';

  const pad    = 36;
  const gap    = 24;
  const rowH   = 34;
  const W      = chartCanvas.width;

  // Header sizes + a roomier gap between the title and the doubling-time value.
  const titleSize = Math.max(16, Math.round(W / 28));
  const valSize   = Math.max(14, Math.round(W / 32));
  const subSize   = Math.max(11, Math.round(W / 64));
  const titleY = 42;
  const valueY = titleY + valSize + 30;              // extra breathing room
  const ciY    = valueY + subSize + 14;
  const statsY = ciY + subSize + 8;
  const headH  = statsY + 18;

  // Shareable link — the same URL the "Copy Link" button produces — so the
  // image can be reopened later to add more measurements. Wrapped to fit width.
  const shareUrl = window.location.origin + window.location.pathname + '?' +
    new URLSearchParams(PSA_INPUT_IDS.reduce(function (acc, id) {
      const el = document.getElementById(id);
      if (el && el.value !== '') acc[id] = el.value;
      return acc;
    }, {})).toString();

  const urlSize   = Math.max(10, Math.round(W / 82));
  const urlLineH  = urlSize + 5;
  const measureCtx = document.createElement('canvas').getContext('2d');
  measureCtx.font = urlSize + 'px monospace';
  const urlLines = wrapTextToWidth(measureCtx, shareUrl, W - pad * 2);
  const footerH  = gap + (urlSize + 8) + urlLines.length * urlLineH + pad;

  const tableH = (lastData.length + 2) * rowH + pad * 2 + gap;
  const H      = headH + gap + chartCanvas.height + tableH + footerH;

  const out = document.createElement('canvas');
  out.width  = W;
  out.height = H;
  const c = out.getContext('2d');

  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, W, H);

  // Title
  c.fillStyle = '#111111';
  c.font = `bold ${titleSize}px ${font}`;
  c.fillText('PSA Doubling Time', pad, titleY);

  // Doubling time value
  c.fillStyle = '#1565c0';
  c.font = `bold ${valSize}px ${font}`;
  c.fillText(dt, pad, valueY);

  // CI + R²/velocity subtitle
  c.fillStyle = '#555555';
  c.font = `${subSize}px ${font}`;
  if (ciText)    c.fillText(ciText, pad, ciY);
  if (statsText) c.fillText(statsText, pad, statsY);

  // Chart
  c.drawImage(chartCanvas, 0, headH + gap);

  // Table
  let y       = headH + gap + chartCanvas.height + pad + gap;
  const col2x = pad + Math.round(W * 0.22);
  const hSize = Math.max(12, Math.round(W / 56));
  const tSize = Math.max(13, Math.round(W / 48));

  // Table header
  c.fillStyle = '#666666';
  c.font = `bold ${hSize}px ${font}`;
  c.fillText('PSA (ng/mL)', pad, y);
  c.fillText('Date', col2x, y);
  y += 10;

  c.fillStyle = '#cccccc';
  c.fillRect(pad, y, W - pad * 2, 1);
  y += rowH;

  // Table rows
  for (let i = 0; i < lastData.length; i++) {
    const { date, psaValue } = lastData[i];

    c.fillStyle = '#111111';
    c.font = `${tSize}px ${font}`;
    c.fillText(psaValue.toFixed(3), pad, y);
    c.fillStyle = '#444444';
    c.fillText(fmtDate(date), col2x, y);
    y += rowH;
  }

  // Shareable-link footer
  y += gap;
  c.fillStyle = '#888888';
  c.font = `${urlSize}px ${font}`;
  c.fillText('Reopen / add measurements at:', pad, y);
  y += urlSize + 8;
  c.fillStyle = '#1565c0';
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
  for (const { date, psaValue } of data) {
    const row = table.insertRow(-1);
    row.insertCell(0).textContent = fmtDate(date);
    row.insertCell(1).textContent = psaValue.toFixed(2);
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
  const dupsRemoved = rawData.length - data.length;

  const errEl        = document.getElementById('psaError');
  const resEl        = document.getElementById('psaResults');
  const parsedSecEl  = document.getElementById('parsedSection');

  if (data.length < 2) {
    errEl.textContent = data.length === 0
      ? 'No valid measurements found. Check that each line has a recognisable date and a numeric PSA value.'
      : 'At least 2 measurements are required to calculate a doubling time.';
    errEl.style.display = 'block';
    resEl.style.display = 'none';
    parsedSecEl.style.display = 'none';
    return;
  }

  errEl.style.display = 'none';

  const fit = fitExponential(data);
  if (!fit) {
    errEl.textContent = 'Could not fit the data. Ensure all PSA values are positive numbers.';
    errEl.style.display = 'block';
    resEl.style.display = 'none';
    parsedSecEl.style.display = 'none';
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

  // Disclose measurements dropped from the fit (PSA ≤ 0 / below detection).
  const dropped = data.length - fit.n;
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

  updateParsedTable(data);
  resEl.style.display = 'block';
  parsedSecEl.style.display = 'block';
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
