// Background service worker for Skribbl Auto Guesser.
// Uses chrome.debugger (CDP) to dispatch trusted mouse events on the drawing canvas.

const attachedTabs = new Map(); // tabId -> { attached: true }

function ensureAttached(tabId) {
  return new Promise((resolve, reject) => {
    if (attachedTabs.has(tabId)) { resolve(); return; }
    chrome.debugger.attach({ tabId }, '1.2', () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      attachedTabs.set(tabId, { attached: true });
      resolve();
    });
  });
}

function detachTab(tabId) {
  return new Promise((resolve) => {
    if (!attachedTabs.has(tabId)) { resolve(); return; }
    chrome.debugger.detach({ tabId }, () => {
      attachedTabs.delete(tabId);
      resolve();
    });
  });
}

function cdpCommand(tabId, method, params) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand({ tabId }, method, params, (result) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(result);
    });
  });
}

async function dispatchDot(tabId, x, y) {
  await cdpCommand(tabId, 'Input.dispatchMouseEvent', {
    type: 'mouseMoved', x, y,
  });
  await cdpCommand(tabId, 'Input.dispatchMouseEvent', {
    type: 'mousePressed', x, y, button: 'left', clickCount: 1,
  });
  await cdpCommand(tabId, 'Input.dispatchMouseEvent', {
    type: 'mouseReleased', x, y, button: 'left', clickCount: 1,
  });
}

async function dispatchStroke(tabId, x1, y1, x2, y2) {
  await cdpCommand(tabId, 'Input.dispatchMouseEvent', {
    type: 'mouseMoved', x: x1, y: y1,
  });
  await cdpCommand(tabId, 'Input.dispatchMouseEvent', {
    type: 'mousePressed', x: x1, y: y1, button: 'left', clickCount: 1,
  });
  await cdpCommand(tabId, 'Input.dispatchMouseEvent', {
    type: 'mouseMoved', x: x2, y: y2,
  });
  await cdpCommand(tabId, 'Input.dispatchMouseEvent', {
    type: 'mouseReleased', x: x2, y: y2, button: 'left', clickCount: 1,
  });
}

async function dispatchClick(tabId, x, y) {
  await cdpCommand(tabId, 'Input.dispatchMouseEvent', {
    type: 'mouseMoved', x, y,
  });
  await cdpCommand(tabId, 'Input.dispatchMouseEvent', {
    type: 'mousePressed', x, y, button: 'left', clickCount: 1,
  });
  await cdpCommand(tabId, 'Input.dispatchMouseEvent', {
    type: 'mouseReleased', x, y, button: 'left', clickCount: 1,
  });
}

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!sender.tab) return false;
  const tabId = sender.tab.id;

  if (msg.action === 'debuggerAttach') {
    ensureAttached(tabId)
      .then(() => sendResponse({ ok: true }))
      .catch(e => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  if (msg.action === 'debuggerDetach') {
    detachTab(tabId)
      .then(() => sendResponse({ ok: true }))
      .catch(e => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  if (msg.action === 'drawDot') {
    ensureAttached(tabId)
      .then(() => dispatchDot(tabId, msg.x, msg.y))
      .then(() => sendResponse({ ok: true }))
      .catch(e => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  if (msg.action === 'drawDots') {
    (async () => {
      try {
        await ensureAttached(tabId);
        const pts = msg.points; // [[x,y], [x,y], ...]
        for (let i = 0; i < pts.length; i++) {
          await dispatchDot(tabId, pts[i][0], pts[i][1]);
        }
        sendResponse({ ok: true, count: pts.length });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true;
  }

  if (msg.action === 'drawStroke') {
    ensureAttached(tabId)
      .then(() => dispatchStroke(tabId, msg.x1, msg.y1, msg.x2, msg.y2))
      .then(() => sendResponse({ ok: true }))
      .catch(e => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  if (msg.action === 'clickAt') {
    ensureAttached(tabId)
      .then(() => dispatchClick(tabId, msg.x, msg.y))
      .then(() => sendResponse({ ok: true }))
      .catch(e => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  return false;
});

// Clean up when debugger is externally detached (user clicks cancel on the yellow bar)
chrome.debugger.onDetach.addListener((source) => {
  if (source.tabId) attachedTabs.delete(source.tabId);
});

// Clean up when tab closes
chrome.tabs.onRemoved.addListener((tabId) => {
  attachedTabs.delete(tabId);
});
