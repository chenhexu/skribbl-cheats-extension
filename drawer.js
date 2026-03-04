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

  // ── Color distance ───────────────────────────────────────────────────────
  function colorDistSq(r1, g1, b1, r2, g2, b2) {
    const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
    return dr * dr + dg * dg + db * db;
  }

  function nearestColorId(r, g, b, skipWhite) {
    const pal = skipWhite ? PALETTE_NO_WHITE : PALETTE;
    let best = pal[0], bestD = Infinity;
    for (let i = 0; i < pal.length; i++) {
      const d = colorDistSq(r, g, b, pal[i].r, pal[i].g, pal[i].b);
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

  function sampleToPoints(canvas, step) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data, w = canvas.width;
    const points = [];
    for (let y = 0; y < canvas.height; y += step) {
      for (let x = 0; x < w; x += step) {
        const i = (y * w + x) * 4;
        if (d[i + 3] < 128) continue;
        points.push({ x, y, colorId: nearestColorId(d[i], d[i + 1], d[i + 2], true) });
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

  function processImage(img, options) {
    const { bgThreshold, density, maxPoints } = options;
    const step = Math.max(1, Math.round(11 - density));
    let canvas = resizeImageToCanvas(img);
    if (bgThreshold > 0) canvas = removeBackground(canvas, bgThreshold);
    let points = sampleToPoints(canvas, step);
    // Sort by color to minimise color-switch overhead
    points.sort((a, b) => a.colorId - b.colorId);
    if (maxPoints > 0 && points.length > maxPoints) points = downsamplePoints(points, maxPoints);
    return { canvas, points };
  }

  // ── Drawing: socket bridge (via page-context script injected by socket-hook.js)
  // We communicate via CustomEvent because content scripts and page scripts
  // have isolated JS worlds but share the same DOM/event system.

  function checkSocketReady(cb) {
    const handler = (e) => {
      window.removeEventListener('__sagSocketReady', handler);
      cb(e.detail);
    };
    window.addEventListener('__sagSocketReady', handler);
    window.dispatchEvent(new CustomEvent('__sagSocketCheck'));
    // Timeout in case the hook script didn't load
    setTimeout(() => {
      window.removeEventListener('__sagSocketReady', handler);
      cb(false);
    }, 200);
  }

  function sendViaSocket(commands) {
    // Draw commands format (Socket.io type 4 = message + event):
    // 42["drawCommands",[[0,colorId,brushSize,x1,y1,x2,y2],...]]
    const payload = '42["drawCommands",' + JSON.stringify(commands) + ']';
    window.dispatchEvent(new CustomEvent('__sagDraw', { detail: payload }));
  }

  // ── Drawing: mouse simulation fallback ──────────────────────────────────
  // Used only if socket is not available.

  function findGameCanvas() {
    const all = document.querySelectorAll('canvas');
    for (const c of all) {
      if (c.width >= 300 && c.height >= 200) return c;
    }
    return all[0] || null;
  }

  function findColorElements() {
    const box = document.querySelector('.containerColorbox') ||
                document.querySelector('[class*="colorbox"]');
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

  let lastClickedColorId = -1;

  function clickColor(colorId) {
    if (colorId === lastClickedColorId) return;
    const target = PALETTE[colorId];
    if (!target) return;
    for (const btn of findColorElements()) {
      const bg = btn.style.backgroundColor || getComputedStyle(btn).backgroundColor;
      const m = bg.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
      if (!m) continue;
      if (colorDistSq(+m[1], +m[2], +m[3], target.r, target.g, target.b) < 400) {
        btn.click();
        lastClickedColorId = colorId;
        return;
      }
    }
  }

  function drawDotMouse(canvasEl, x, y) {
    if (!canvasEl || !canvasEl.isConnected) return false;
    const rect = canvasEl.getBoundingClientRect();
    const scaleX = rect.width / CANVAS_W, scaleY = rect.height / CANVAS_H;
    const clientX = rect.left + x * scaleX, clientY = rect.top + y * scaleY;
    const mk = (type, buttons) => new MouseEvent(type, {
      bubbles: true, cancelable: true, button: 0, buttons,
      clientX, clientY, offsetX: x * scaleX, offsetY: y * scaleY,
    });
    canvasEl.dispatchEvent(mk('mousedown', 1));
    canvasEl.dispatchEvent(mk('mousemove', 1));
    canvasEl.dispatchEvent(mk('mouseup', 0));
    return true;
  }

  // ── Drawing orchestrator ────────────────────────────────────────────────

  let drawState = {
    running: false, points: [], index: 0,
    timer: null, onProgress: null, onDone: null,
    method: 'socket',
  };

  function stopDrawing() {
    drawState.running = false;
    if (drawState.timer) { clearTimeout(drawState.timer); drawState.timer = null; }
  }

  function startDrawing(points, options) {
    stopDrawing();
    const { chunkSize, chunkDelayMs, brushSize, onProgress, onDone } = options;
    drawState.running = true;
    drawState.points = points;
    drawState.index = 0;
    drawState.onProgress = onProgress || null;
    drawState.onDone = onDone || null;

    // Decide method: socket if available, mouse otherwise
    checkSocketReady((socketOk) => {
      drawState.method = socketOk ? 'socket' : 'mouse';

      const canvasEl = drawState.method === 'mouse' ? findGameCanvas() : null;
      if (drawState.method === 'mouse' && !canvasEl) {
        drawState.running = false;
        if (onDone) onDone('No socket and no canvas found');
        return;
      }

      if (drawState.method === 'mouse') {
        // Pick smallest brush by clicking brush size buttons
        const brushBtns = Array.from(
          document.querySelectorAll('.containerBrushSizes div, [class*="brush"] div')
        );
        const idx = brushSize <= 4 ? 0 : brushSize <= 10 ? 1 : brushSize <= 20 ? 2 : brushSize <= 32 ? 3 : 4;
        if (brushBtns[Math.min(idx, brushBtns.length - 1)]) {
          brushBtns[Math.min(idx, brushBtns.length - 1)].click();
        }
        lastClickedColorId = -1;
      }

      // Callback so caller knows which method is being used
      if (options.onMethod) options.onMethod(drawState.method);

      let currentColorId = -1;

      function tick() {
        if (!drawState.running) return;
        if (drawState.method === 'mouse' && canvasEl && !canvasEl.isConnected) {
          drawState.running = false;
          if (drawState.onDone) drawState.onDone('Canvas disappeared');
          return;
        }

        const end = Math.min(drawState.index + chunkSize, points.length);

        if (drawState.method === 'socket') {
          const cmds = [];
          for (let i = drawState.index; i < end; i++) {
            const p = points[i];
            cmds.push([0, p.colorId, brushSize,
              Math.round(p.x), Math.round(p.y),
              Math.round(p.x), Math.round(p.y)]);
          }
          if (cmds.length) sendViaSocket(cmds);
        } else {
          for (let i = drawState.index; i < end; i++) {
            const p = points[i];
            if (p.colorId !== currentColorId) {
              clickColor(p.colorId);
              currentColorId = p.colorId;
            }
            if (!drawDotMouse(canvasEl, p.x, p.y)) break;
          }
        }

        drawState.index = end;
        if (drawState.onProgress) drawState.onProgress(drawState.index, points.length);

        if (drawState.index >= points.length) {
          drawState.running = false;
          if (drawState.onDone) drawState.onDone(null);
          return;
        }
        drawState.timer = setTimeout(tick, chunkDelayMs);
      }

      tick();
    });
  }

  // ── Estimate drawing time ───────────────────────────────────────────────

  function estimateTime(pointCount, chunkSize, chunkDelayMs) {
    return Math.round((Math.ceil(pointCount / chunkSize) * chunkDelayMs) / 1000);
  }

  // ── Expose ───────────────────────────────────────────────────────────────

  window.__skribblDrawer = {
    PALETTE, CANVAS_W, CANVAS_H,
    processImage, startDrawing, stopDrawing, estimateTime,
    isDrawing: () => drawState.running,
    getProgress: () => ({ index: drawState.index, total: drawState.points.length }),
    checkSocketReady,
  };
})();
