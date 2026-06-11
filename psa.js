// PSA Doubling Time Calculator
// Weighted least-squares exponential fitting: y = A * exp(B * x)
// Reference: https://mathworld.wolfram.com/LeastSquaresFittingExponential.html

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
      if (!isNaN(n) && n >= 0) { psaValue = n; }
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

// -------------------------------------------------------------------------
// Least-squares exponential fit
// -------------------------------------------------------------------------

const MS_PER_DAY = 86400000;

/**
 * Fit y = A * exp(B * x) to the data using weighted least squares,
 * with weights w_i = y_i^2 (MathWorld formula).
 *
 * x is measured in days from the first data point.
 *
 * Also computes the variance-covariance matrix for ln(A) and B so that
 * confidence bands can be drawn around the projection.
 *
 * Returns { A, B, doublingTimeDays, firstDate, pts, varA, varB, covAB, n }
 * or null on failure.
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

  // Weighted sums (weights w_i = y_i^2)
  let S1 = 0, S2 = 0, S3 = 0, S4 = 0, S5 = 0;
  for (const { x, y } of pts) {
    const w   = y * y;
    const lny = Math.log(y);
    S1 += w;
    S2 += w * x;
    S3 += w * x * x;
    S4 += w * lny;
    S5 += w * x * lny;
  }

  const denom = S1 * S3 - S2 * S2;
  if (Math.abs(denom) < 1e-15) return null;

  const B = (S1 * S5 - S2 * S4) / denom;
  const lnA = (S4 - B * S2) / S1;
  const A = Math.exp(lnA);
  const doublingTimeDays = Math.log(2) / B;

  // Weighted residual variance for the linearised model: ln(y) = lnA + B*x
  const n = pts.length;
  let ssRes = 0;
  for (const { x, y } of pts) {
    const w   = y * y;
    const r   = Math.log(y) - lnA - B * x;
    ssRes += w * r * r;
  }
  const s2 = n > 2 ? ssRes / (n - 2) : 0;

  // Variance-covariance of (lnA, B)
  const varLnA = s2 * S3 / denom;
  const varB   = s2 * S1 / denom;
  const covAB  = -s2 * S2 / denom;

  return { A, B, doublingTimeDays, firstDate, pts, varLnA, varB, covAB, n };
}

// -------------------------------------------------------------------------
// Chart
// -------------------------------------------------------------------------

let psaChart  = null;
let whiteMode = false;
let lastData  = null;
let lastFit   = null;
let defaultProjectionYears = 2;

function fmtDate(date) {
  return date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
}

function fmtDoublingTime(days) {
  if (days < 0)   return `PSA is decreasing (rate constant implies halving, not doubling)`;
  if (days < 60)  return `${days.toFixed(1)} days`;
  if (days < 730) return `${(days / 30.44).toFixed(1)} months`;
  return `${(days / 365.25).toFixed(2)} years  (${(days / 30.44).toFixed(1)} months)`;
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
  const projYrs     = Math.max(0.5, parseFloat(document.getElementById('projectionYears').value) || defaultProjectionYears);
  const chartStart  = new Date(data[0].date);
  const chartEnd    = new Date(data[data.length - 1].date.getTime() + projYrs * MS_PER_YEAR);

  const { pts: curve, upper, lower, hasBands } = buildCurve(fit, chartStart, chartEnd);
  const measured = data.map(d => ({ x: new Date(d.date), y: d.psaValue }));

  if (psaChart) { psaChart.destroy(); psaChart = null; }

  const ctx = document.getElementById('psaChart').getContext('2d');

  const datasets = [
    {
      label: 'Measured PSA',
      data: measured,
      backgroundColor: '#4fc3f7',
      borderColor: '#4fc3f7',
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
      pointRadius: 0,
      pointHitRadius: 10,
      borderWidth: 2.5,
      tension: 0,
      order: 2
    }
  ];

  if (hasBands) {
    datasets.push({
      label: '95% CI',
      data: upper,
      type: 'line',
      borderColor: 'rgba(239,83,80,0.3)',
      backgroundColor: 'rgba(239,83,80,0.10)',
      fill: '+1',   // fill between this dataset and the next (lower)
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
            filter: item => item.text !== '95% CI Lower'
          },
          onClick: function(evt, legendItem, legend) {
            const ci = legendItem.text === '95% CI';
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
        y: {
          ticks: { color: tickColor },
          grid:  { color: gridColor },
          title: { display: true, text: 'PSA (ng/mL)', color: titleColor }
        }
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
      afterDraw(chart) {
        const c2 = chart.canvas.getContext('2d');
        c2.save();
        const fontSize = Math.max(10, Math.round(chart.width / 72));
        c2.font = `${fontSize}px system-ui, sans-serif`;
        c2.fillStyle = light ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.18)';
        c2.textAlign = 'right';
        c2.textBaseline = 'bottom';
        c2.fillText('oncologytoolkit.com', chart.width - 10, chart.height - 8);
        c2.restore();
      }
    }]
  });
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
  if (xMs == null) { tooltip.style.display = 'none'; return; }

  const hoverDate = new Date(xMs);
  const dx  = (hoverDate.getTime() - fit.firstDate.getTime()) / MS_PER_DAY;
  const psa = fit.A * Math.exp(fit.B * dx);

  // Check if cursor is near the fit line (within 30px vertically)
  const fitYPixel = psaChart.scales.y.getPixelForValue(psa);
  if (Math.abs(pos.y - fitYPixel) > 30) {
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
  if (xMs == null) return;

  const clickedDate = new Date(xMs);
  const dx  = (clickedDate.getTime() - fit.firstDate.getTime()) / MS_PER_DAY;
  const psa = fit.A * Math.exp(fit.B * dx);

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

function copyResults() {
  if (!lastData || !lastFit) return;
  const btn         = document.getElementById('copyResultsBtn');
  const dt          = document.getElementById('doublingTime').textContent;
  const chartCanvas = document.getElementById('psaChart');

  const font = 'Arial, Helvetica, sans-serif';

  const pad    = 36;
  const headH  = 100;
  const gap    = 24;
  const rowH   = 34;
  const tableH = (lastData.length + 2) * rowH + pad * 2 + gap;
  const W      = chartCanvas.width;
  const H      = headH + gap + chartCanvas.height + tableH;

  const out = document.createElement('canvas');
  out.width  = W;
  out.height = H;
  const c = out.getContext('2d');

  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, W, H);

  // Title
  const titleSize = Math.max(16, Math.round(W / 28));
  c.fillStyle = '#111111';
  c.font = `bold ${titleSize}px ${font}`;
  c.fillText('PSA Doubling Time', pad, Math.round(headH * 0.42));

  // Doubling time value
  const valSize = Math.max(14, Math.round(W / 32));
  c.fillStyle = '#1565c0';
  c.font = `bold ${valSize}px ${font}`;
  c.fillText(dt, pad, Math.round(headH * 0.78));

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
  const data = parseInput(text);

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
