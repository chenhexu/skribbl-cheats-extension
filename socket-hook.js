// Runs at document_start. Injects the page-context hook by loading a separate
// script file (no inline script), so CSP does not block execution.
(function () {
  var script = document.createElement('script');
  script.src = chrome.runtime.getURL('page-hook.js');
  script.onload = function () { script.remove(); };
  (document.head || document.documentElement).appendChild(script);
})();
