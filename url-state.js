// Shared URL parameter utilities for calculator pages.
//
// Data flow:
//   Page Load → parseUrlParams(ids) → applyUrlParams() → trigger update()
//   "Copy Link" → serializeToUrl(ids) → clipboard
//
// Param keys match HTML element IDs (e.g., bd-dose, bd-fx).
// Invalid/unknown keys are silently ignored.

function parseUrlParams(inputIds) {
  var params = new URLSearchParams(window.location.search);
  var result = {};
  inputIds.forEach(function (id) {
    var val = params.get(id);
    if (val !== null) {
      var num = parseFloat(val);
      if (!isNaN(num) && isFinite(num)) {
        result[id] = num;
      }
    }
  });
  return result;
}

function applyUrlParams(params) {
  Object.keys(params).forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.value = params[id];
  });
}

function serializeToUrl(inputIds) {
  var params = new URLSearchParams();
  inputIds.forEach(function (id) {
    var el = document.getElementById(id);
    if (el && el.value !== '') {
      params.set(id, el.value);
    }
  });
  return window.location.pathname + '?' + params.toString();
}

function initUrlParams(inputIds, updateFn) {
  var params = parseUrlParams(inputIds);
  if (Object.keys(params).length > 0) {
    applyUrlParams(params);
  }
  if (updateFn) updateFn();
}

function setupCopyLinkButton(buttonId, inputIds) {
  var btn = document.getElementById(buttonId);
  if (!btn) return;
  btn.addEventListener('click', function () {
    var url = window.location.origin + window.location.pathname + '?' +
      new URLSearchParams(
        inputIds.reduce(function (acc, id) {
          var el = document.getElementById(id);
          if (el && el.value !== '') acc[id] = el.value;
          return acc;
        }, {})
      ).toString();
    copyToClipboard(url, function () {
      var orig = btn.textContent;
      btn.textContent = '\u2713 Link Copied!';
      setTimeout(function () { btn.textContent = orig; }, 1500);
    });
  });
}
