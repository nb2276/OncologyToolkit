// Shared clipboard helper with fallback for older browsers / permission denial.
//
//   copyToClipboard(text, onSuccess)
//     Tries navigator.clipboard.writeText first.
//     Falls back to textarea + execCommand('copy').

function copyToClipboard(text, onSuccess) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function () {
      if (onSuccess) onSuccess();
    }).catch(function () {
      clipboardFallback(text, onSuccess);
    });
  } else {
    clipboardFallback(text, onSuccess);
  }
}

function clipboardFallback(text, onSuccess) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    if (onSuccess) onSuccess();
  } catch (e) { /* silent */ }
  document.body.removeChild(ta);
}
