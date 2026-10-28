// Background service worker for Skribbl Auto Guesser.
// Uses chrome.debugger (CDP) to dispatch trusted mouse events on the drawing canvas.

const attachedTabs = new Map(); // tabId -> { attached: true }

importScripts('plan-transport.js');
importScripts('browser-ai/bridge.js');
const browserAI = new SAGBrowserAIBridge(chrome);
const planTransport = new SAGPlanTransport({ attach: ensureAttached, detach: detachTab, command: cdpCommand });
const aiRequests = new Map();
const studioSessions = new Map();
const LOCAL_AI = 'http://127.0.0.1:8765';

async function aiRequest(msg, sender) {
  if (['aiLineart','aiSubject'].includes(msg.action) && (typeof msg.image !== 'string' || !msg.image.startsWith('data:image/png;base64,') || msg.image.length > 6*1024*1024)) throw new Error('Invalid image request');
  const words = msg.action === 'aiWordSearch';
  if (words && (typeof msg.query !== 'string' || !msg.query.trim() || msg.query.length > 128 || !Array.isArray(msg.candidates) || msg.candidates.length > 20000 || msg.candidates.some(w => typeof w !== 'string' || !w.length || w.length > 128))) throw new Error('Invalid word-search request');
  const key = (sender.tab?.id ?? 'studio') + ':' + (msg.id || crypto.randomUUID());
  const controller = new AbortController();
  aiRequests.set(key, controller);
  const timer = setTimeout(() => controller.abort(), words ? 30000 : 120000);
  try {
    const mode=await browserAI.mode();
    controller.signal.throwIfAborted();
    if(mode!=='python')return await browserAI.request({...msg,id:key},mode,controller.signal);
    if (!(await chrome.permissions.contains({ origins: [LOCAL_AI+'/*'] }))) {
      throw new Error('Enable local AI access in AI setup, or choose in-Chrome AI there');
    }
    controller.signal.throwIfAborted();
    const health = ['aiHealth','aiPrepare'].includes(msg.action);
    const response = await fetch(LOCAL_AI + (health ? '/health' : words ? '/api/word-search' : msg.action === 'aiSubject' ? '/api/subject' : '/api/lineart'), {
      method: health ? 'GET' : 'POST', signal: controller.signal,
      ...(health ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(words ? {query:msg.query,candidates:msg.candidates} : { image: msg.image }) }),
    });
    if (!response.ok) { if(response.status===404&&msg.action==='aiSubject')throw new Error('Restart the updated local Python service for subject detection.');const body = await response.json().catch(() => ({})); throw new Error(body.error || 'Local AI service failed (' + response.status + ')'); }
    if (health) return { ok: true, health: await response.json() };
    if (words) return { ok: true, ...await response.json() };
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > 6*1024*1024) throw new Error('Local AI image is too large');
    let binary = '';for (let i=0;i<bytes.length;i+=8192) binary += String.fromCharCode(...bytes.subarray(i,i+8192));
    return { ok: true, image: 'data:image/png;base64,' + btoa(binary) };
  } catch (error) {
    throw new Error(error.name === 'AbortError' ? 'Local AI request stopped or timed out' : 'Local AI: ' + error.message);
  } finally { clearTimeout(timer);if(aiRequests.get(key)===controller)aiRequests.delete(key); }
}

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

// Multi-point curve: move to p0, press, move to p1..pn-1, release at pn-1
async function dispatchCurve(tabId, points) {
  if (!points || points.length < 2) return;
  const p0 = points[0];
  await cdpCommand(tabId, 'Input.dispatchMouseEvent', {
    type: 'mouseMoved', x: p0.x, y: p0.y,
  });
  await cdpCommand(tabId, 'Input.dispatchMouseEvent', {
    type: 'mousePressed', x: p0.x, y: p0.y, button: 'left', clickCount: 1,
  });
  for (let i = 1; i < points.length; i++) {
    await cdpCommand(tabId, 'Input.dispatchMouseEvent', {
      type: 'mouseMoved', x: points[i].x, y: points[i].y,
    });
  }
  const last = points[points.length - 1];
  await cdpCommand(tabId, 'Input.dispatchMouseEvent', {
    type: 'mouseReleased', x: last.x, y: last.y, button: 'left', clickCount: 1,
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

// Send a key press (e.g. "u" for Skribbl undo)
async function dispatchKey(tabId, key) {
  const k = (key || 'u').toLowerCase();
  const code = k.length === 1 ? 'Key' + k.toUpperCase() : key;
  const windowsVirtualKeyCode = k.toUpperCase().charCodeAt(0);
  await cdpCommand(tabId, 'Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: k,
    code: code,
    windowsVirtualKeyCode,
  });
  await cdpCommand(tabId, 'Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: k,
    code: code,
    windowsVirtualKeyCode,
  });
}

// Handle messages from content scripts (guard for extension context)
if (typeof chrome !== 'undefined' && chrome.runtime) {
  // Keep-alive port: content script opens this during CDP drawing so the service worker
  // is not terminated mid-draw (MV3 service workers go inactive when idle).
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name.startsWith('planKeepAlive:') && port.sender?.tab?.id) {
      const tabId=port.sender.tab.id,runId=port.name.slice('planKeepAlive:'.length);
      port.onDisconnect.addListener(() => { planTransport.cancel(tabId,runId).catch(() => {}); });
    }
    if (port.name === 'drawKeepAlive') {
      port.onDisconnect.addListener(() => {});
    }
  });

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || sender.id !== chrome.runtime.id) return false;
    if(msg.target==='browser-ai-offscreen')return false;
    const answer = promise => { Promise.resolve(promise).then(value => sendResponse({ ok: true, ...value })).catch(e => sendResponse({ ok: false, error: e.message, cancelled: e.name === 'AbortError' }));return true; };
    if (['aiHealth','aiLineart','aiSubject','aiWordSearch'].includes(msg.action)) return answer(aiRequest(msg, sender));
    if(msg.action==='aiConfiguration')return answer(browserAI.mode().then(mode=>({mode})));
    if(msg.action==='aiConfigure'){
      if(!sender.url?.startsWith(chrome.runtime.getURL('ai-setup.html')))return false;
      for(const controller of aiRequests.values())controller.abort();
      return answer(browserAI.configure(msg.mode));
    }
    if(msg.action==='aiPrepare')return answer(aiRequest(msg,sender));
    if(msg.action==='aiUnload'){
      if(!sender.url?.startsWith(chrome.runtime.getURL('ai-setup.html')))return false;
      for(const controller of aiRequests.values())controller.abort();return answer(browserAI.close());
    }
    if (msg.action === 'aiCancel') { aiRequests.get((sender.tab?.id ?? 'studio') + ':' + msg.id)?.abort();sendResponse({ok:true});return false; }
    if (msg.action === 'openStudio') {
      return answer((async () => {
        for (const [id, value] of studioSessions) if (Date.now()-value.created>300000) studioSessions.delete(id);
        if (studioSessions.size >= 8) studioSessions.delete(studioSessions.keys().next().value);
        const id=crypto.randomUUID();
        if (msg.session && JSON.stringify(msg.session).length > 6*1024*1024) throw new Error('Preview image is too large');
        studioSessions.set(id,{created:Date.now(),session:msg.session||{}});
        await chrome.tabs.create({url:chrome.runtime.getURL(msg.setup?'ai-setup.html':'dev-line-art/studio.html')+'?session='+id});
      })());
    }
    if (msg.action === 'studioSession') {
      if (!sender.url?.startsWith(chrome.runtime.getURL('dev-line-art/studio.html'))) return false;
      const stored=studioSessions.get(msg.id);studioSessions.delete(msg.id);sendResponse({ok:true,session:stored?.session||{}});return false;
    }
    if (!sender.tab) return false;
    const tabId = sender.tab.id;

    if (['planBegin','planStroke','planTool','planCancel'].includes(msg.action)) {
      if (sender.frameId !== 0 || !/^https:\/\/skribbl\.io\//.test(sender.url || sender.tab.url || '')) return false;
      if (msg.action === 'planBegin') return answer(planTransport.begin(tabId,msg.runId));
      if (msg.action === 'planStroke') return answer(planTransport.stroke(tabId,msg.runId,msg.points));
      if (msg.action === 'planTool') return answer(planTransport.tool(tabId,msg.runId,msg.points));
      return answer(planTransport.cancel(tabId,msg.runId));
    }

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

    if (msg.action === 'drawCurve') {
      ensureAttached(tabId)
        .then(() => dispatchCurve(tabId, msg.points))
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

    if (msg.action === 'debuggerSendKey') {
      ensureAttached(tabId)
        .then(() => dispatchKey(tabId, msg.key || 'u'))
        .then(() => sendResponse({ ok: true }))
        .catch(e => sendResponse({ ok: false, error: e.message }));
      return true;
    }

    return false;
  });

  // Clean up when debugger is externally detached (user clicks cancel on the yellow bar)
  chrome.debugger.onDetach.addListener((source) => {
    if (source.tabId) attachedTabs.delete(source.tabId);
    if (source.tabId) planTransport.disconnected(source.tabId);
  });

  // Clean up when tab closes
  chrome.tabs.onRemoved.addListener((tabId) => {
    attachedTabs.delete(tabId);
    planTransport.disconnected(tabId);
    planTransport.cancel(tabId).catch(() => {});
    for (const [key, controller] of aiRequests) if (key.startsWith(tabId+':')) controller.abort();
  });
}
