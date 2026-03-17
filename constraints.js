// Dose Constraint Reference — search/filter QUANTEC and HyTEC data.
// Data loaded from constraints-data.json via fetch.

var CONSTRAINTS = [];
var constraintsTable = document.getElementById('constraintsTable');
var constraintSearch = document.getElementById('constraintSearch');
var constraintResults = document.getElementById('constraintResults');
var sourceFilter = document.getElementById('sourceFilter');
var loadingEl = document.getElementById('constraintLoading');
var resultCount = document.getElementById('resultCount');

// Load data
fetch('constraints-data.json')
  .then(function (res) {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  })
  .then(function (data) {
    CONSTRAINTS = data;
    if (loadingEl) loadingEl.style.display = 'none';
    performConstraintSearch();
  })
  .catch(function () {
    if (loadingEl) {
      loadingEl.textContent = 'Failed to load constraint data. Please refresh the page.';
      loadingEl.classList.add('loading-error');
    }
  });

function performConstraintSearch() {
  var term = (constraintSearch.value || '').toLowerCase();
  var source = sourceFilter ? sourceFilter.value : 'all';
  var words = term.split(/\s+/).filter(function (w) { return w.length > 0; });

  // Clear table (keep header)
  while (constraintsTable.rows.length > 1) {
    constraintsTable.deleteRow(-1);
  }

  var count = 0;
  for (var i = 0; i < CONSTRAINTS.length; i++) {
    var c = CONSTRAINTS[i];

    // Source filter
    if (source !== 'all' && c.source.toLowerCase() !== source) continue;

    // Text search — AND-match across organ, endpoint, constraint, fractionation
    var searchable = (c.organ + ' ' + c.endpoint + ' ' + c.constraint + ' ' + c.fractionation + ' ' + c.source).toLowerCase();
    var match = true;
    for (var j = 0; j < words.length; j++) {
      if (searchable.indexOf(words[j]) === -1) {
        match = false;
        break;
      }
    }
    if (!match) continue;

    count++;
    var row = constraintsTable.insertRow(-1);
    row.insertCell(0).textContent = c.organ;
    row.insertCell(1).textContent = c.constraint;
    row.insertCell(2).textContent = c.endpoint;
    row.insertCell(3).textContent = c.rate || '—';
    row.insertCell(4).textContent = c.fractionation;
    var sourceCell = row.insertCell(5);
    sourceCell.innerHTML = '<span class="constraint-source-badge constraint-source-' +
      c.source.toLowerCase() + '">' + c.source + '</span>';
    row.insertCell(6).textContent = c.citation;
  }

  if (resultCount) {
    resultCount.textContent = count + ' constraint' + (count !== 1 ? 's' : '');
  }

  constraintResults.style.display = count > 0 ? 'block' : 'none';
}

var searchTimer = null;
constraintSearch.addEventListener('input', function () {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(performConstraintSearch, 150);
});

if (sourceFilter) {
  sourceFilter.addEventListener('change', performConstraintSearch);
}
