(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // Skribbl.io Auto-Drawer Module
  // ═══════════════════════════════════════════════════════════════════════════

  const CANVAS_W = 800;
  const CANVAS_H = 600;

  // ── Skribbl palette (22 colors, index = protocol color ID) ──────────────
  const PALETTE = [
    { id: 0,  hex: '#ffffff', r: 255, g: 255, b: 255 },
    { id: 1,  hex: '#000000', r: 0,   g: 0,   b: 0   },
    { id: 2,  hex: '#c1c1c1', r: 193, g: 193, b: 193 },
    { id: 3,  hex: '#4c4c4c', r: 76,  g: 76,  b: 76  },
    { id: 4,  hex: '#ef130b', r: 239, g: 19,  b: 11  },
    { id: 5,  hex: '#740b07', r: 116, g: 11,  b: 7   },
    { id: 6,  hex: '#ff7100', r: 255, g: 113, b: 0   },
    { id: 7,  hex: '#c23800', r: 194, g: 56,  b: 0   },
    { id: 8,  hex: '#ffe400', r: 255, g: 228, b: 0   },
    { id: 9,  hex: '#e8a200', r: 232, g: 162, b: 0   },
    { id: 10, hex: '#00cc00', r: 0,   g: 204, b: 0   },
    { id: 11, hex: '#005510', r: 0,   g: 85,  b: 16  },
    { id: 12, hex: '#00b2ff', r: 0,   g: 178, b: 255 },
    { id: 13, hex: '#00569e', r: 0,   g: 86,  b: 158 },
    { id: 14, hex: '#231fd3', r: 35,  g: 31,  b: 211 },
    { id: 15, hex: '#0e0865', r: 14,  g: 8,   b: 101 },
    { id: 16, hex: '#a300ba', r: 163, g: 0,   b: 186 },
    { id: 17, hex: '#550069', r: 85,  g: 0,   b: 105 },
    { id: 18, hex: '#d37caa', r: 211, g: 124, b: 170 },
    { id: 19, hex: '#a75574', r: 167, g: 85,  b: 116 },
    { id: 20, hex: '#a0522d', r: 160, g: 82,  b: 45  },
    { id: 21, hex: '#63300d', r: 99,  g: 48,  b: 13  },
  ];

  const PALETTE_NO_WHITE = PALETTE.filter(c => c.id !== 0);

  // ── sRGB -> CIELAB for perceptual color matching ────────────────────────

  function srgbToLinear(c) {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  function rgbToLab(r, g, b) {
    let x = srgbToLinear(r) * 0.4124564 + srgbToLinear(g) * 0.3575761 + srgbToLinear(b) * 0.1804375;
    let y = srgbToLinear(r) * 0.2126729 + srgbToLinear(g) * 0.7151522 + srgbToLinear(b) * 0.0721750;
    let z = srgbToLinear(r) * 0.0193339 + srgbToLinear(g) * 0.1191920 + srgbToLinear(b) * 0.9503041;
    x /= 0.95047; y /= 1.00000; z /= 1.08883;
    const f = (t) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
    return {
      L: 116 * f(y) - 16,
      a: 500 * (f(x) - f(y)),
      b: 200 * (f(y) - f(z)),
    };
  }

  // Precompute LAB for each palette entry
  PALETTE.forEach(c => {
    const lab = rgbToLab(c.r, c.g, c.b);
    c.L = lab.L; c.A = lab.a; c.B = lab.b;
  });

  // ── Color distance (perceptual, CIELAB Delta E) ─────────────────────────

  function colorDistSq(r1, g1, b1, r2, g2, b2) {
    const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
    return dr * dr + dg * dg + db * db;
  }

  function labDistSq(L1, a1, b1, L2, a2, b2) {
    const dL = L1 - L2, da = a1 - a2, db = b1 - b2;
    return dL * dL + da * da + db * db;
  }

  function nearestColorId(r, g, b, skipWhite) {
    const pal = skipWhite ? PALETTE_NO_WHITE : PALETTE;
    const lab = rgbToLab(r, g, b);
    let best = pal[0], bestD = Infinity;
    for (let i = 0; i < pal.length; i++) {
      const d = labDistSq(lab.L, lab.a, lab.b, pal[i].L, pal[i].A, pal[i].B);
      if (d < bestD) { bestD = d; best = pal[i]; }
    }
    return best.id;
  }

  // ── Image pipeline ──────────────────────────────────────────────────────

  function resizeImageToCanvas(img) {
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    const scale = Math.min(CANVAS_W / img.width, CANVAS_H / img.height);
    const w = img.width * scale, h = img.height * scale;
    ctx.drawImage(img, (CANVAS_W - w) / 2, (CANVAS_H - h) / 2, w, h);
    return canvas;
  }

  function removeBackground(canvas, threshold) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;
    const t = threshold * threshold * 3;
    for (let i = 0; i < d.length; i += 4) {
      const dr = 255 - d[i], dg = 255 - d[i + 1], db = 255 - d[i + 2];
      if (dr * dr + dg * dg + db * db < t) d[i + 3] = 0;
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  function sampleToPoints(canvas, step, skipWhite) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data, w = canvas.width;
    const points = [];
    for (let y = 0; y < canvas.height; y += step) {
      for (let x = 0; x < w; x += step) {
        const i = (y * w + x) * 4;
        if (d[i + 3] < 128) continue;
        const cId = nearestColorId(d[i], d[i + 1], d[i + 2], skipWhite);
        if (skipWhite && cId === 0) continue;
        points.push({ x, y, colorId: cId });
      }
    }
    return points;
  }

  function downsamplePoints(points, maxPoints) {
    if (points.length <= maxPoints) return points;
    const step = points.length / maxPoints;
    const out = [];
    for (let i = 0; i < maxPoints; i++) out.push(points[Math.floor(i * step)]);
    return out;
  }

  // ── Path ordering: nearest-neighbor within each color group ──────────
  // Groups points by colorId (preserving back-to-front order), then within
  // each group reorders by greedy nearest-neighbor to minimise pen travel.

  function orderPointsByPath(points) {
    if (points.length <= 1) return points;

    // Group by color, preserving order of first appearance (back-to-front)
    const groupMap = new Map();
    for (let i = 0; i < points.length; i++) {
      const cId = points[i].colorId;
      if (!groupMap.has(cId)) groupMap.set(cId, []);
      groupMap.get(cId).push(points[i]);
    }

    const result = [];
    for (const [, group] of groupMap) {
      if (group.length <= 2) {
        for (let i = 0; i < group.length; i++) result.push(group[i]);
        continue;
      }
      // Nearest-neighbor ordering
      const used = new Uint8Array(group.length);
      const ordered = [group[0]];
      used[0] = 1;
      let cx = group[0].x, cy = group[0].y;
      for (let n = 1; n < group.length; n++) {
        let bestIdx = -1, bestD = Infinity;
        for (let j = 0; j < group.length; j++) {
          if (used[j]) continue;
          const dx = group[j].x - cx, dy = group[j].y - cy;
          const d = dx * dx + dy * dy;
          if (d < bestD) { bestD = d; bestIdx = j; }
        }
        used[bestIdx] = 1;
        ordered.push(group[bestIdx]);
        cx = group[bestIdx].x;
        cy = group[bestIdx].y;
      }
      for (let i = 0; i < ordered.length; i++) result.push(ordered[i]);
    }
    return result;
  }

  function processImage(img, options) {
    const { bgThreshold, density, maxPoints, useWhite } = options;
    const skipWhite = useWhite === false;
    const step = Math.max(1, Math.round(11 - density));
    let canvas = resizeImageToCanvas(img);
    if (bgThreshold > 0) canvas = removeBackground(canvas, bgThreshold);
    let points = sampleToPoints(canvas, step, skipWhite);
    // Draw back-to-front: higher color ids first, black (1) last so contour stays on top
    points.sort((a, b) => b.colorId - a.colorId);
    // Path-optimize within each color group (nearest-neighbor)
    points = orderPointsByPath(points);
    if (maxPoints > 0 && points.length > maxPoints) points = downsamplePoints(points, maxPoints);
    return { canvas, points };
  }

  // ── Socket bridge (via page-context postMessage) ────────────────────────

  function checkSocketReady(cb) {
    const handler = (e) => {
      if (e.source !== window || !e.data || e.data._sag !== true || e.data.action !== 'socketReady') return;
      window.removeEventListener('message', handler);
      if (timeoutId) clearTimeout(timeoutId);
      cb(!!e.data.ready);
    };
    window.addEventListener('message', handler);
    window.postMessage({ _sag: true, action: 'socketCheck' }, '*');
    var timeoutId = setTimeout(() => {
      timeoutId = null;
      window.removeEventListener('message', handler);
      cb(false);
    }, 800);
  }

  function sendViaSocket(commands) {
    const payload = '42["drawCommands",' + JSON.stringify(commands) + ']';
    window.postMessage({ _sag: true, action: 'draw', payload: payload }, '*');
  }

  // ── Debugger bridge (via chrome.runtime.sendMessage to background) ──────

  function sendToBg(msg) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(msg, (resp) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(resp || { ok: false, error: 'no response' });
        }
      });
    });
  }

  async function debuggerAttach() {
    return sendToBg({ action: 'debuggerAttach' });
  }

  async function debuggerDetach() {
    return sendToBg({ action: 'debuggerDetach' });
  }

  async function debuggerDrawDot(viewportX, viewportY) {
    return sendToBg({ action: 'drawDot', x: viewportX, y: viewportY });
  }

  async function debuggerDrawDots(points) {
    return sendToBg({ action: 'drawDots', points: points });
  }

  async function debuggerDrawStroke(x1, y1, x2, y2) {
    return sendToBg({ action: 'drawStroke', x1, y1, x2, y2 });
  }

  async function debuggerClickAt(viewportX, viewportY) {
    return sendToBg({ action: 'clickAt', x: viewportX, y: viewportY });
  }

  function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  async function checkDebuggerReady() {
    const resp = await debuggerAttach();
    return resp && resp.ok === true;
  }

  // ── Canvas and color detection ──────────────────────────────────────────

  function listAllCanvases() {
    const out = [];
    const all = document.querySelectorAll('canvas');
    all.forEach(function (c, i) {
      const rect = c.getBoundingClientRect();
      const style = window.getComputedStyle(c);
      const visible = rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      out.push({
        index: i, width: c.width, height: c.height,
        displayWidth: Math.round(rect.width), displayHeight: Math.round(rect.height),
        top: Math.round(rect.top), left: Math.round(rect.left),
        id: c.id || '(no id)',
        className: (c.className && typeof c.className === 'string') ? c.className : '(none)',
        visible: visible, el: c,
      });
    });
    return out;
  }

  function findGameCanvas(logFn) {
    const noop = function () {};
    const log = typeof logFn === 'function' ? logFn : noop;
    const all = listAllCanvases();
    log('Canvas scan: found ' + all.length + ' canvas(es) on page');
    all.forEach(function (info) {
      log('  [' + info.index + '] ' + info.width + 'x' + info.height + ' display ' + info.displayWidth + 'x' + info.displayHeight + ' at (' + info.left + ',' + info.top + ') id=' + info.id + ' class=' + info.className.substring(0, 60) + (info.visible ? ' visible' : ' hidden'));
    });

    const bySize = all.filter(function (info) { return info.width >= 300 && info.height >= 200; });
    if (bySize.length > 0) {
      log('Canvas pick: chose index ' + bySize[0].index + ' by size (>=300x200)');
      return bySize[0].el;
    }

    const selectors = [
      'canvas[width="800"][height="600"]', 'canvas[height="600"]',
      '.containerGame canvas', '.containerCanvas canvas', '#game canvas',
      '[class*="canvas"] canvas', '[class*="draw"] canvas',
    ];
    for (var s = 0; s < selectors.length; s++) {
      try {
        const el = document.querySelector(selectors[s]);
        if (el && el.tagName === 'CANVAS') { log('Canvas pick: chose by selector "' + selectors[s] + '"'); return el; }
      } catch (e) {}
    }

    if (all.length > 0) { log('Canvas pick: falling back to first canvas (index 0)'); return all[0].el; }
    log('Canvas pick: none'); return null;
  }

  function findColorElements() {
    const box = document.querySelector('.containerColorbox') || document.querySelector('[class*="colorbox"]');
    if (box) {
      return Array.from(box.querySelectorAll('div')).filter(d => {
        const bg = d.style.backgroundColor || '';
        return bg.startsWith('rgb');
      });
    }
    const candidates = document.querySelectorAll('div[style*="background"]');
    const result = [];
    for (const d of candidates) {
      const s = d.getBoundingClientRect();
      if (s.width > 10 && s.width < 60 && s.height > 10 && s.height < 60) {
        const bg = d.style.backgroundColor || getComputedStyle(d).backgroundColor;
        if (bg && bg.startsWith('rgb')) result.push(d);
      }
    }
    return result;
  }

  function findBrushSizeElements() {
    return Array.from(document.querySelectorAll('.containerBrushSizes div, [class*="brush"] div'));
  }

  // ── Viewport coordinate helpers ─────────────────────────────────────────
  // CDP Input.dispatchMouseEvent uses viewport (layout viewport) coordinates.

  function gameToViewport(canvasEl, gameX, gameY) {
    const rect = canvasEl.getBoundingClientRect();
    const scaleX = rect.width / CANVAS_W;
    const scaleY = rect.height / CANVAS_H;
    return {
      x: Math.round(rect.left + gameX * scaleX),
      y: Math.round(rect.top + gameY * scaleY),
    };
  }

  function elementCenter(el) {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  }

  // ── Color clicking via CDP ──────────────────────────────────────────────

  let lastClickedColorId = -1;

  async function clickColorCDP(colorId, logFn) {
    if (colorId === lastClickedColorId) return;
    const target = PALETTE[colorId];
    if (!target) return;
    const colorEls = findColorElements();
    for (const btn of colorEls) {
      const bg = btn.style.backgroundColor || getComputedStyle(btn).backgroundColor;
      const m = bg.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
      if (!m) continue;
      if (colorDistSq(+m[1], +m[2], +m[3], target.r, target.g, target.b) < 400) {
        const c = elementCenter(btn);
        await debuggerClickAt(c.x, c.y);
        await delay(80);
        lastClickedColorId = colorId;
        return;
      }
    }
    if (logFn) logFn('clickColorCDP: no match for colorId=' + colorId);
  }

  async function clickBrushSizeCDP(brushSize, logFn) {
    const btns = findBrushSizeElements();
    const idx = brushSize <= 4 ? 0 : brushSize <= 10 ? 1 : brushSize <= 20 ? 2 : brushSize <= 32 ? 3 : 4;
    const btn = btns[Math.min(idx, btns.length - 1)];
    if (btn) {
      const c = elementCenter(btn);
      await debuggerClickAt(c.x, c.y);
      await delay(120);
      if (logFn) logFn('clickBrushSizeCDP: brushSize=' + brushSize + ' -> index=' + idx + ' (wait applied)');
    } else if (logFn) {
      logFn('clickBrushSizeCDP: no brush button found (count=' + btns.length + ')');
    }
  }

  // ── Calibration ─────────────────────────────────────────────────────────

  const CALIBRATION_BRUSH = 20;
  const CALIBRATION_DOTS = [
    { x: 80, y: 80, colorId: 1 },
    { x: CANVAS_W - 80, y: 80, colorId: 4 },
    { x: CANVAS_W - 80, y: CANVAS_H - 80, colorId: 10 },
    { x: 80, y: CANVAS_H - 80, colorId: 14 },
    { x: CANVAS_W / 2, y: CANVAS_H / 2, colorId: 16 },
  ];

  async function runCalibration(options) {
    const log = options.log || function () {};
    const onDone = options.onDone || function () {};

    const canvasEl = findGameCanvas(log);
    if (!canvasEl) {
      log('Calibration: no canvas found.');
      onDone('No canvas found');
      return;
    }
    const rect = canvasEl.getBoundingClientRect();
    log('Calibration: canvas ' + canvasEl.width + 'x' + canvasEl.height + ', display ' + Math.round(rect.width) + 'x' + Math.round(rect.height) + ' at (' + Math.round(rect.left) + ',' + Math.round(rect.top) + ')');

    const colorEls = findColorElements();
    log('Calibration: color buttons=' + colorEls.length);

    // Try debugger first
    log('Calibration: attempting debugger (CDP) path...');
    const dbgOk = await checkDebuggerReady();
    log('Calibration: debugger attach=' + dbgOk);

    if (dbgOk) {
      try {
        await clickBrushSizeCDP(CALIBRATION_BRUSH, log);
        for (let i = 0; i < CALIBRATION_DOTS.length; i++) {
          const p = CALIBRATION_DOTS[i];
          await clickColorCDP(p.colorId, log);
          const vp = gameToViewport(canvasEl, p.x, p.y);
          const resp = await debuggerDrawDot(vp.x, vp.y);
          log('Calibration: CDP dot ' + (i + 1) + '/' + CALIBRATION_DOTS.length + ' at game(' + p.x + ',' + p.y + ') -> viewport(' + vp.x + ',' + vp.y + ') color=' + p.colorId + ' ok=' + (resp && resp.ok));
        }
        log('Calibration: 5 dots sent via CDP. Check canvas.');
        onDone(null);
      } catch (e) {
        log('Calibration: CDP error: ' + e.message);
        onDone('CDP error: ' + e.message);
      }
      return;
    }

    // Try socket
    log('Calibration: debugger unavailable, trying socket...');
    checkSocketReady((socketOk) => {
      log('Calibration: socket ready=' + socketOk);
      if (socketOk) {
        const cmds = CALIBRATION_DOTS.map(p => [0, p.colorId, CALIBRATION_BRUSH, p.x, p.y, p.x, p.y]);
        sendViaSocket(cmds);
        log('Calibration: sent ' + cmds.length + ' dots via socket.');
        onDone(null);
        return;
      }

      log('Calibration: no debugger and no socket. Cannot draw.');
      onDone('No debugger and no socket available');
    });
  }

  // ── Drawing orchestrator ────────────────────────────────────────────────

  let drawState = {
    running: false, points: [], index: 0,
    timer: null, onProgress: null, onDone: null,
    method: 'cdp',
  };

  function stopDrawing() {
    drawState.running = false;
    if (drawState.timer) { clearTimeout(drawState.timer); drawState.timer = null; }
  }

  function startDrawing(points, options) {
    stopDrawing();
    const { chunkSize, chunkDelayMs, brushSize, onProgress, onDone, log: logOpt } = options;
    const noop = function () {};
    const logFn = typeof logOpt === 'function' ? logOpt : noop;

    drawState.running = true;
    drawState.points = points;
    drawState.index = 0;
    drawState.onProgress = onProgress || null;
    drawState.onDone = onDone || null;

    // Method priority: CDP debugger > socket > (nothing)
    (async () => {
      const canvasEl = findGameCanvas(logFn);
      if (!canvasEl) {
        drawState.running = false;
        logFn('Draw: no canvas found');
        if (onDone) onDone('No canvas found');
        return;
      }

      logFn('Draw: attempting debugger attach...');
      const dbgOk = await checkDebuggerReady();
      logFn('Draw: debugger=' + dbgOk);

      if (dbgOk) {
        drawState.method = 'cdp';
        if (options.onMethod) options.onMethod('cdp (trusted mouse)');
        logFn('Draw: using CDP, brushSize=' + brushSize + ', chunkSize=' + chunkSize + ', delay=' + chunkDelayMs + 'ms');
        await clickBrushSizeCDP(brushSize, logFn);
        lastClickedColorId = -1;
        runCDPLoop(points, canvasEl, chunkSize, chunkDelayMs, brushSize, logFn);
        return;
      }

      logFn('Draw: debugger unavailable, checking socket...');
      checkSocketReady((socketOk) => {
        if (socketOk) {
          drawState.method = 'socket';
          if (options.onMethod) options.onMethod('socket');
          logFn('Draw: using socket');
          runSocketLoop(points, chunkSize, chunkDelayMs, brushSize, logFn);
        } else {
          drawState.running = false;
          logFn('Draw: no debugger and no socket');
          if (onDone) onDone('No debugger and no socket available. Reload the page and try again.');
        }
      });
    })();
  }

  // Max distance (in game coords) for a stroke between two same-color points
  const MAX_STROKE_DIST = 50;

  // CDP draw loop: uses strokes for nearby same-color consecutive points
  async function runCDPLoop(points, canvasEl, chunkSize, chunkDelayMs, brushSize, logFn) {
    let currentColorId = -1;
    let chunkCount = 0;
    let strokeCount = 0, dotCount = 0;

    async function tick() {
      if (!drawState.running) return;

      const end = Math.min(drawState.index + chunkSize, points.length);

      for (let i = drawState.index; i < end; i++) {
        if (!drawState.running) return;
        const p = points[i];
        if (p.colorId !== currentColorId) {
          await clickColorCDP(p.colorId, null);
          currentColorId = p.colorId;
        }

        // Try to draw a stroke to the next point if same color and nearby
        if (i + 1 < end && points[i + 1].colorId === p.colorId) {
          const np = points[i + 1];
          const dx = np.x - p.x, dy = np.y - p.y;
          if (dx * dx + dy * dy <= MAX_STROKE_DIST * MAX_STROKE_DIST) {
            const vp1 = gameToViewport(canvasEl, p.x, p.y);
            const vp2 = gameToViewport(canvasEl, np.x, np.y);
            await debuggerDrawStroke(vp1.x, vp1.y, vp2.x, vp2.y);
            strokeCount++;
            i++;
            continue;
          }
        }

        const vp = gameToViewport(canvasEl, p.x, p.y);
        await debuggerDrawDot(vp.x, vp.y);
        dotCount++;
      }
      chunkCount++;
      if (chunkCount === 1) logFn('Draw: first CDP chunk done');

      drawState.index = end;
      if (drawState.onProgress) drawState.onProgress(drawState.index, points.length);

      if (drawState.index >= points.length) {
        drawState.running = false;
        logFn('Draw: finished via CDP, points=' + points.length + ', strokes=' + strokeCount + ', dots=' + dotCount + ', chunks=' + chunkCount);
        if (drawState.onDone) drawState.onDone(null);
        return;
      }

      drawState.timer = setTimeout(() => tick(), chunkDelayMs);
    }

    await tick();
  }

  // Socket draw loop: sends drawCommands packets in chunks
  function runSocketLoop(points, chunkSize, chunkDelayMs, brushSize, logFn) {
    let chunkCount = 0;

    function tick() {
      if (!drawState.running) return;

      const end = Math.min(drawState.index + chunkSize, points.length);
      const cmds = [];
      for (let i = drawState.index; i < end; i++) {
        const p = points[i];
        cmds.push([0, p.colorId, brushSize, Math.round(p.x), Math.round(p.y), Math.round(p.x), Math.round(p.y)]);
      }
      if (cmds.length) {
        sendViaSocket(cmds);
        chunkCount++;
        if (chunkCount === 1) logFn('Draw: first socket chunk sent, ' + cmds.length + ' commands');
      }

      drawState.index = end;
      if (drawState.onProgress) drawState.onProgress(drawState.index, points.length);

      if (drawState.index >= points.length) {
        drawState.running = false;
        logFn('Draw: finished via socket, points=' + points.length + ', chunks=' + chunkCount);
        if (drawState.onDone) drawState.onDone(null);
        return;
      }
      drawState.timer = setTimeout(tick, chunkDelayMs);
    }

    tick();
  }

  // ── Estimate drawing time ───────────────────────────────────────────────

  function estimateTime(pointCount, chunkSize, chunkDelayMs) {
    return Math.round((Math.ceil(pointCount / chunkSize) * chunkDelayMs) / 1000);
  }

  // ── Canvas scan ─────────────────────────────────────────────────────────

  function runCanvasScan(logFn) {
    const log = typeof logFn === 'function' ? logFn : function () {};
    const chosen = findGameCanvas(log);
    if (chosen) {
      const r = chosen.getBoundingClientRect();
      log('Canvas scan done. Chosen: ' + chosen.width + 'x' + chosen.height + '.');
      log('  Top-left at viewport: (' + Math.round(r.left) + ', ' + Math.round(r.top) + '). Drawing coords (0,0)-(800,600) map inside this rectangle.');
    } else {
      log('Canvas scan done. No canvas chosen.');
    }
    return chosen;
  }

  // ── Expose ───────────────────────────────────────────────────────────────

  window.__skribblDrawer = {
    PALETTE, CANVAS_W, CANVAS_H,
    processImage, startDrawing, stopDrawing, estimateTime,
    runCalibration, runCanvasScan,
    listAllCanvases, findGameCanvas,
    checkSocketReady, checkDebuggerReady,
    debuggerAttach, debuggerDetach,
    isDrawing: () => drawState.running,
    getProgress: () => ({ index: drawState.index, total: drawState.points.length }),
  };
})();
