const xhr_ICD = new XMLHttpRequest();
const icd_url = "icd10.xml";
const maxSearch = 100;

const ICD_10_CODES = new Array();

// Define a callback function to handle the response loading ICD 10 codes
xhr_ICD.onreadystatechange = function() {
  if (xhr_ICD.readyState === XMLHttpRequest.DONE) {
    const loadingEl = document.getElementById('loadingIndicator');

    if (xhr_ICD.status === 200) {
      // Parse the XML response
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xhr_ICD.responseText, "text/xml");
      const diag = xmlDoc.getElementsByTagName("diag");

      // Loop over the codes and add them to the array
      for (let i = 0; i < diag.length; i++) {
        const code = diag[i];
        const id = code.getElementsByTagName("name")[0].textContent;
        const desc = code.getElementsByTagName("desc")[0].textContent;
        ICD_10_CODES.push([id, desc]);
      }

      // Hide loading indicator
      if (loadingEl) loadingEl.style.display = 'none';
    } else {
      if (loadingEl) {
        loadingEl.textContent = 'Failed to load diagnosis codes. Please refresh the page.';
        loadingEl.classList.add('loading-error');
      }
    }
  }
};

xhr_ICD.onerror = function() {
  const loadingEl = document.getElementById('loadingIndicator');
  if (loadingEl) {
    loadingEl.textContent = 'Failed to load diagnosis codes. Please refresh the page.';
    loadingEl.classList.add('loading-error');
  }
};

xhr_ICD.timeout = 30000;
xhr_ICD.ontimeout = function() {
  const loadingEl = document.getElementById('loadingIndicator');
  if (loadingEl) {
    loadingEl.textContent = 'Loading timed out. Please refresh the page.';
    loadingEl.classList.add('loading-error');
  }
};

// Open the request and send it
xhr_ICD.open("GET", icd_url, true);
xhr_ICD.send();


// Load into DOM
const searchTerm = document.getElementById("searchTerm");
const codesTable = document.getElementById("codesTable");
const results = document.getElementById("results");
const selectMalignantchecked = document.getElementById('selectMalignant');
const selectInSituchecked = document.getElementById('selectInSitu');
const selectBenignchecked = document.getElementById('selectBenign');
const selectZchecked = document.getElementById('selectZ');

['all', 'selectMalignant', 'selectInSitu', 'selectBenign', 'selectZ'].forEach(function(id) {
  document.getElementById(id).addEventListener('change', performSearch);
});

function performSearch(){
  // Get the search term
  let term = searchTerm.value.toLowerCase();

  // If the radio button is checked, append a specific word to the search term
  if (selectMalignantchecked.checked) {
    term += ' malignant';
  }

  if(selectInSituchecked.checked) {
    term += ' in situ';
  }

  if(selectBenignchecked.checked) {
    term += ' benign';
  }

  if(selectZchecked.checked) {
    term += ' personal history neoplasm';
  }

  const words = term.split(" ");

  // Clear the table (keep header row)
  while (codesTable.rows.length > 1) {
      codesTable.deleteRow(-1);
  }

  // Search the ICD-10 codes for the term
  for (const [code, diagnosis] of ICD_10_CODES) {
    if(codesTable.rows.length>maxSearch) break;
    let match = true;
    for (const word of words){
      if(!(diagnosis.toLowerCase().includes(word) || code.toLowerCase().includes(word))) {
        match = false;
        break;
      }
    }
    if(match) {
      const row = codesTable.insertRow(-1);
      const codeCell = row.insertCell(0);
      const diagnosisCell = row.insertCell(1);
      codeCell.textContent = code;
      codeCell.className = 'code-cell';
      codeCell.title = 'Click to copy';
      codeCell.addEventListener('click', function () {
        navigator.clipboard.writeText(code).then(function () {
          codeCell.textContent = '✓ Copied';
          codeCell.classList.add('code-cell-copied');
          setTimeout(function () {
            codeCell.textContent = code;
            codeCell.classList.remove('code-cell-copied');
          }, 1200);
        });
      });
      diagnosisCell.innerHTML =
        '<span class="diag-text">' + diagnosis + '</span>' +
        '<button class="diag-copy-btn" title="Copy diagnosis">\u29c9</button>';
      diagnosisCell.querySelector('.diag-copy-btn').addEventListener('click', function (e) {
        e.stopPropagation();
        const btn2 = e.currentTarget;
        navigator.clipboard.writeText(diagnosis).then(function () {
          btn2.textContent = '\u2713';
          setTimeout(function () { btn2.textContent = '\u29c9'; }, 1200);
        });
      });
    }
  }

    //Show or hide the results based on whether there are any codes found
    if (codesTable.rows.length > 0 && term.length>0) {
      results.style.display = "block";
    } else {
      results.style.display = "none";
    }
};

let searchTimer = null;
searchTerm.addEventListener("input", function() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(performSearch, 150);
});
