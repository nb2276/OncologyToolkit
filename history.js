// Shared calculation history using localStorage.
//
// Data flow:
//   Save: update() → saveToHistory(tool, ids) → dedupe → prepend → cap 10 → write
//   Load: page load → renderHistory(tool, ids, updateFn, summaryFn) → collapsible list
//   Click item: fill inputs → trigger update() → update URL

var HISTORY_MAX = 10;

// extraParams (optional) is a flat { key: value } object merged into the saved
// params alongside the DOM-read inputIds. ReRT uses it to persist state that
// lives outside a fixed input list — which OARs are selected (`rert-oars`) and
// their per-OAR prior doses (`dose-<id>`). Because these land in `params`, they
// participate in dedup, ride along in getRecentAcrossTools, and round-trip the URL.
function saveToHistory(toolName, inputIds, extraParams) {
  try {
    var entry = { ts: Date.now(), params: {} };
    inputIds.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) entry.params[id] = el.value;
    });
    if (extraParams) {
      Object.keys(extraParams).forEach(function (k) {
        entry.params[k] = extraParams[k];
      });
    }
    var key = 'history_' + toolName;
    var history = loadHistoryRaw(key);
    // Deduplicate: remove existing entry with same params
    var paramsStr = JSON.stringify(entry.params);
    history = history.filter(function (h) {
      return JSON.stringify(h.params) !== paramsStr;
    });
    history.unshift(entry);
    if (history.length > HISTORY_MAX) history = history.slice(0, HISTORY_MAX);
    localStorage.setItem(key, JSON.stringify(history));
  } catch (e) {
    // Silent fail — history is non-critical
  }
}

function loadHistoryRaw(key) {
  try {
    var data = localStorage.getItem(key);
    if (!data) return [];
    var parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function loadHistory(toolName) {
  return loadHistoryRaw('history_' + toolName);
}

function clearHistory(toolName) {
  try { localStorage.removeItem('history_' + toolName); } catch (e) { /* silent */ }
}

// restoreFn (optional) overrides the default per-key value assignment when a
// history item is clicked. Tools whose state can't be restored by simply writing
// item.params[id] into matching elements (ReRT must re-tick OAR checkboxes to
// rebuild dose inputs before filling them) pass a restoreFn that owns the entire
// restore — including calling updateFn and updating the URL.
function renderHistory(toolName, inputIds, updateFn, summaryFn, restoreFn) {
  var container = document.getElementById('history-section');
  if (!container) return;
  var items = loadHistory(toolName);
  if (items.length === 0) {
    container.style.display = 'none';
    return;
  }
  container.style.display = '';
  var list = container.querySelector('.history-list');
  if (!list) return;
  list.innerHTML = '';
  items.forEach(function (item) {
    var li = document.createElement('div');
    li.className = 'history-item';
    li.textContent = summaryFn ? summaryFn(item.params) : defaultHistorySummary(item.params);
    li.title = new Date(item.ts).toLocaleString();
    li.addEventListener('click', function () {
      if (restoreFn) {
        // Tool owns the full restore (values + update + URL). See ReRT.
        restoreFn(item.params);
        return;
      }
      Object.keys(item.params).forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = item.params[id];
      });
      if (updateFn) updateFn();
      // Update URL without reload
      var url = serializeToUrl(inputIds);
      window.history.replaceState(null, '', url);
      // Re-render history (moved to top via dedupe on next save)
    });
    list.appendChild(li);
  });

  // Clear button
  var clearBtn = container.querySelector('.history-clear');
  if (clearBtn) {
    clearBtn.onclick = function () {
      clearHistory(toolName);
      renderHistory(toolName, inputIds, updateFn, summaryFn);
    };
  }
}

function defaultHistorySummary(params) {
  var parts = [];
  Object.keys(params).forEach(function (key) {
    if (params[key] !== '') parts.push(params[key]);
  });
  return parts.join(' / ');
}

// ------------------------------------------------------------------
// Per-tool summary functions — single source of truth.
// bed.js, composite.js, rert.js all call these (instead of inline lambdas)
// so the per-page history list and the hub's recents pills render the
// identical text for any given entry.
// ------------------------------------------------------------------

function bedSummary(p) {
  return (p['bd-dose'] || '?') + ' Gy / ' + (p['bd-fx'] || '?') + ' fx';
}

function compositeSummary(p) {
  return 'Tol ' + (p['st-dose'] || '?') + 'Gy, Prior ' + (p['pv-dose'] || '?') + 'Gy';
}

function rertSummary(p) {
  // OAR selection + doses ARE persisted now (params['rert-oars'] + dose-<id>),
  // so a recalled entry restores the full case. The pill label stays terse —
  // prior fx + months — because organ lists would overflow the recents row.
  var n = p['rert-oars'] ? p['rert-oars'].split(',').filter(Boolean).length : 0;
  var oarPart = n ? ', ' + n + ' OAR' + (n > 1 ? 's' : '') : '';
  return 'prior ' + (p['pr-fx'] || '?') + ' fx, ' + (p['pr-mo'] || '?') + ' mo ago' + oarPart;
}

// ------------------------------------------------------------------
// Cross-tool recents — used by the hub landing page (index.html).
// Reads localStorage for each known tool, merges, sorts by ts desc,
// slices to `limit`. Defensively filters entries missing `ts` or
// `params` (hand-edited localStorage, future schema drift).
// ------------------------------------------------------------------

var KNOWN_TOOLS = [
  { tool: 'bed',       path: 'bed.html',       label: bedSummary },
  { tool: 'composite', path: 'composite.html', label: compositeSummary },
  { tool: 'rert',      path: 'rert.html',      label: rertSummary }
];

function getRecentAcrossTools(limit) {
  var all = [];
  KNOWN_TOOLS.forEach(function (t) {
    loadHistoryRaw('history_' + t.tool).forEach(function (entry) {
      if (typeof entry.ts !== 'number' || !entry.params) return;
      all.push({
        tool: t.tool,
        ts: entry.ts,
        params: entry.params,
        path: t.path,
        label: t.label(entry.params)
      });
    });
  });
  all.sort(function (a, b) { return b.ts - a.ts; });
  return all.slice(0, limit || 3);
}
