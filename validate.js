// Shared input-range warning helper used by bed.js / composite.js / rert.js.
// Goal: prevent fat-finger errors on dose / fraction inputs.
//
// Four states:
//   - val < 0                                → red "Cannot be negative"
//   - range.integer && !Number.isInteger(val) → red "Must be a whole number"
//   - val outside range                      → yellow typical-range hint
//   - val valid or NaN                       → no warning
//
// `range` is { min, max, label, integer? }. `label` is shown for out-of-range
// (non-negative, integer-valid) values. Negatives and non-integer fractions
// always show their hard-stop messages because they're physically impossible:
// you can't deliver -5 sessions, and you can't deliver 25.5 sessions either —
// fraction count is the number of times the patient comes to the linac.

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

  if (range.integer && !Number.isInteger(val)) {
    warnEl.textContent = '⚠ Must be a whole number';
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
//   'ok'           — in range or NaN
//   'negative'     — val < 0
//   'non-integer'  — range.integer && !Number.isInteger(val) (and val >= 0)
//   'low'          — 0 <= val < min (and integer if required)
//   'high'         — val > max (and integer if required)
function classifyRange(val, range) {
  if (isNaN(val)) return 'ok';
  if (val < 0) return 'negative';
  if (range.integer && !Number.isInteger(val)) return 'non-integer';
  if (val < range.min) return 'low';
  if (val > range.max) return 'high';
  return 'ok';
}
