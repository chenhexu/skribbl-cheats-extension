// Runs at document_start — injects a script into the PAGE context (not the
// extension isolated world) so it can hook window.WebSocket BEFORE the
// game's code creates the connection.
(function () {
  const src = `(function() {
    var _WS = window.WebSocket;
    var _socket = null;

    // Wrap WebSocket to capture the skribbl game socket
    window.WebSocket = function(url, protocols) {
      var ws = protocols ? new _WS(url, protocols) : new _WS(url);
      // skribbl servers live at skribbl.io or server*.skribbl.io on high ports
      if (typeof url === 'string' &&
          (url.includes('skribbl') || /:\\d{4,5}\\//.test(url))) {
        _socket = ws;
      }
      return ws;
    };
    window.WebSocket.prototype  = _WS.prototype;
    window.WebSocket.CONNECTING = _WS.CONNECTING;
    window.WebSocket.OPEN       = _WS.OPEN;
    window.WebSocket.CLOSING    = _WS.CLOSING;
    window.WebSocket.CLOSED     = _WS.CLOSED;

    // Content-script -> page bridge: dispatch draw payload over the socket
    window.addEventListener('__sagDraw', function(e) {
      if (!_socket || _socket.readyState !== 1) return;
      _socket.send(e.detail);
    });

    // Allow content-script to query socket readiness
    window.addEventListener('__sagSocketCheck', function() {
      var ready = !!_socket && _socket.readyState === 1;
      window.dispatchEvent(new CustomEvent('__sagSocketReady', { detail: ready }));
    });
  })();`;

  const el = document.createElement('script');
  el.textContent = src;
  (document.head || document.documentElement).appendChild(el);
  el.remove();
})();
