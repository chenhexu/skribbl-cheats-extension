// Runs in PAGE context. Hooks WebSocket to capture the skribbl game socket.
// Communicates with content script via postMessage.
(function () {
  var _WS = window.WebSocket;
  var _socket = null;
  var _socketUrl = '';

  function captureSocket(url) {
    if (typeof url !== 'string') return false;
    if (url.indexOf('skribbl') !== -1) return true;
    if (/^wss?:\/\//i.test(url) && (url.indexOf('socket') !== -1 || /:\d{2,5}\//.test(url))) return true;
    return false;
  }

  window.WebSocket = function (url, protocols) {
    var ws = protocols ? new _WS(url, protocols) : new _WS(url);
    if (captureSocket(url)) {
      _socket = ws;
      _socketUrl = url;
      console.log('[SAG page-hook] Captured WebSocket:', url, 'readyState:', ws.readyState);
      ws.addEventListener('open', function () {
        console.log('[SAG page-hook] Socket opened:', url);
      });
      ws.addEventListener('close', function () {
        console.log('[SAG page-hook] Socket closed:', url);
        if (_socket === ws) { _socket = null; _socketUrl = ''; }
      });
    }
    return ws;
  };
  window.WebSocket.prototype = _WS.prototype;
  window.WebSocket.CONNECTING = _WS.CONNECTING;
  window.WebSocket.OPEN = _WS.OPEN;
  window.WebSocket.CLOSING = _WS.CLOSING;
  window.WebSocket.CLOSED = _WS.CLOSED;

  window.addEventListener('message', function (e) {
    if (e.source !== window || !e.data || e.data._sag !== true) return;
    var d = e.data;
    if (d.action === 'socketCheck') {
      var ready = !!_socket && _socket.readyState === 1;
      console.log('[SAG page-hook] socketCheck: ready=' + ready + ', url=' + _socketUrl + ', readyState=' + (_socket ? _socket.readyState : 'null'));
      window.postMessage({ _sag: true, action: 'socketReady', ready: ready }, '*');
    } else if (d.action === 'draw' && d.payload) {
      if (_socket && _socket.readyState === 1) {
        console.log('[SAG page-hook] Sending draw payload (' + d.payload.length + ' chars)');
        _socket.send(d.payload);
      } else {
        console.warn('[SAG page-hook] Cannot send draw: socket=' + !!_socket + ', readyState=' + (_socket ? _socket.readyState : 'null'));
      }
    }
  });
})();
