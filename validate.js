// Shared input-range warning helper used by bed.js / composite.js / rert.js.
// Goal: prevent fat-finger errors on dose / fraction inputs.
//
// Three states:
//   - val < 0           → red "Cannot be negative" (.input-range-error)
//   - val outside range → yellow typical-range hint (existing behavior)
//   - val valid or NaN  → no warning
//
// `range` is { min, max, label }. `label` is shown for out-of-range
// (non-negative) values. Negatives always show the same hard-stop message
// because they're never clinically meaningful.

function applyRangeWarning(inputEl, warnEl, range) {
  if (!inputEl || !warnEl) return;
  var val = parseFloat(inputEl.value);

  if (isNaN(val)) {
    warnEl.textContent = '';
    warnEl.style.display = 'none';
    warnEl.classList.remove('input-range-error');
    return;
  }

  if (val < 0) {
    warnEl.textContent = '⚠ Cannot be negative';
    warnEl.style.display = 'block';
    warnEl.classList.add('input-range-error');
    return;
  }

  if (val < range.min || val > range.max) {
    warnEl.textContent = range.label;
    warnEl.style.display = 'block';
    warnEl.classList.remove('input-range-error');
    return;
  }

  warnEl.textContent = '';
  warnEl.style.display = 'none';
  warnEl.classList.remove('input-range-error');
}

// Classify a value against a range. Returned for testability without DOM.
//   'ok'       — in range or NaN
//   'negative' — val < 0
//   'low'      — 0 <= val < min
//   'high'     — val > max
function classifyRange(val, range) {
  if (isNaN(val)) return 'ok';
  if (val < 0) return 'negative';
  if (val < range.min) return 'low';
  if (val > range.max) return 'high';
  return 'ok';
}
