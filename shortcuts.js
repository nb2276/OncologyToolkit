// Global keyboard shortcuts.
// "/" or Ctrl+K: focus the first input or search box
// Escape: blur focused input

(function () {
  document.addEventListener('keydown', function (e) {
    var active = document.activeElement;
    var isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT');

    // Escape — blur current input
    if (e.key === 'Escape' && isInput) {
      active.blur();
      return;
    }

    // "/" or Ctrl+K — focus first input (only if not already typing)
    if ((e.key === '/' || (e.key === 'k' && (e.ctrlKey || e.metaKey))) && !isInput) {
      e.preventDefault();
      // Find the first visible text/number input or textarea
      var inputs = document.querySelectorAll('input[type="text"], input[type="number"], input[type="search"], textarea');
      for (var i = 0; i < inputs.length; i++) {
        if (inputs[i].offsetParent !== null) {
          inputs[i].focus();
          inputs[i].select();
          return;
        }
      }
    }
  });
})();
