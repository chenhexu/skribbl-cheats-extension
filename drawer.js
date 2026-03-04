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

  // ── Color distance (Euclidean in RGB) ───────────────────────────────────
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
    const w = img.width * scale;
    const h = img.height * scale;
    const x = (CANVAS_W - w) / 2;
    const y = (CANVAS_H - h) / 2;
    ctx.drawImage(img, x, y, w, h);
    return canvas;
  }

  function removeBackground(canvas, threshold) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;
    const t = threshold * threshold * 3;
    for (let i = 0; i < d.length; i += 4) {
      const dr = 255 - d[i], dg = 255 - d[i + 1], db = 255 - d[i + 2];
      if (dr * dr + dg * dg + db * db < t) {
        d[i + 3] = 0;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  function sampleToPoints(canvas, step) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;
    const w = canvas.width;
    const points = [];
    for (let y = 0; y < canvas.height; y += step) {
      for (let x = 0; x < w; x += step) {
        const i = (y * w + x) * 4;
        if (d[i + 3] < 128) continue;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const cid = nearestColorId(r, g, b, true);
        points.push({ x, y, colorId: cid });
      }
    }
    return points;
  }

  function downsamplePoints(points, maxPoints) {
    if (points.length <= maxPoints) return points;
    const step = points.length / maxPoints;
    const out = [];
    for (let i = 0; i < maxPoints; i++) {
      out.push(points[Math.floor(i * step)]);
    }
    return out;
  }

  function sortByColor(points) {
    return points.slice().sort((a, b) => a.colorId - b.colorId);
  }

  function processImage(img, options) {
    const { bgThreshold, density, maxPoints } = options;
    const step = Math.max(1, Math.round(11 - density));

    let canvas = resizeImageToCanvas(img);
    if (bgThreshold > 0) {
      canvas = removeBackground(canvas, bgThreshold);
    }
    let points = sampleToPoints(canvas, step);
    points = sortByColor(points);
    if (maxPoints > 0 && points.length > maxPoints) {
      points = downsamplePoints(points, maxPoints);
    }
    return { canvas, points };
  }

  // ── Drawing: mouse simulation on the game canvas ────────────────────────
  // This is the primary drawing method. We find the game's <canvas> element
  // and dispatch mouse events that skribbl.io's client-side JS processes to
  // generate draw commands and send them to the server on our behalf.

  function findGameCanvas() {
    // Skribbl uses a single large canvas inside #containerBoard
    const all = document.querySelectorAll('canvas');
    for (const c of all) {
      // Pick the largest canvas (the drawing board)
      if (c.width >= 300 && c.height >= 200) return c;
    }
    return all[0] || null;
  }

  function findColorElements() {
    // Skribbl color buttons live inside .containerColorbox as child divs
    // with inline background-color styles. Fall back to broad search.
    const box = document.querySelector('.containerColorbox') ||
                document.querySelector('[class*="colorbox"]') ||
                document.querySelector('[class*="color-box"]');
    if (box) {
      const divs = Array.from(box.querySelectorAll('div'));
      return divs.filter(d => {
        const bg = d.style.backgroundColor || '';
        return bg.startsWith('rgb');
      });
    }
    // Broad fallback: find small divs with solid background colors
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
    const box = document.querySelector('.containerBrushSizes') ||
                document.querySelector('[class*="brush"]');
    if (!box) return [];
    return Array.from(box.querySelectorAll('div'));
  }

  let lastClickedColorId = -1;

  function clickColor(colorId) {
    if (colorId === lastClickedColorId) return true;
    const target = PALETTE[colorId];
    if (!target) return false;
    const buttons = findColorElements();
    for (const btn of buttons) {
      const bg = btn.style.backgroundColor || getComputedStyle(btn).backgroundColor;
      const m = bg.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
      if (!m) continue;
      const r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3]);
      if (colorDistSq(r, g, b, target.r, target.g, target.b) < 400) {
        btn.click();
        lastClickedColorId = colorId;
        return true;
      }
    }
    return false;
  }

  function dispatchCanvasEvent(canvasEl, type, gameX, gameY) {
    if (!canvasEl) return;
    const rect = canvasEl.getBoundingClientRect();
    const scaleX = rect.width / CANVAS_W;
    const scaleY = rect.height / CANVAS_H;
    const clientX = rect.left + gameX * scaleX;
    const clientY = rect.top + gameY * scaleY;
    const offsetX = gameX * scaleX;
    const offsetY = gameY * scaleY;
    canvasEl.dispatchEvent(new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
      offsetX,
      offsetY,
      button: 0,
      buttons: type === 'mouseup' ? 0 : 1,
    }));
  }

  function drawDotOnCanvas(canvasEl, x, y) {
    if (!canvasEl || !canvasEl.isConnected) return false;
    dispatchCanvasEvent(canvasEl, 'mousedown', x, y);
    dispatchCanvasEvent(canvasEl, 'mousemove', x, y);
    dispatchCanvasEvent(canvasEl, 'mouseup', x, y);
    return true;
  }

  // ── Drawing orchestrator ────────────────────────────────────────────────

  let drawState = {
    running: false,
    points: [],
    index: 0,
    timer: null,
    onProgress: null,
    onDone: null,
  };

  function stopDrawing() {
    drawState.running = false;
    if (drawState.timer) {
      clearTimeout(drawState.timer);
      drawState.timer = null;
    }
  }

  function startDrawing(points, options) {
    stopDrawing();
    const { chunkSize, chunkDelayMs, brushSize, onProgress, onDone } = options;
    drawState.running = true;
    drawState.points = points;
    drawState.index = 0;
    drawState.onProgress = onProgress || null;
    drawState.onDone = onDone || null;

    const canvasEl = findGameCanvas();
    if (!canvasEl) {
      drawState.running = false;
      if (onDone) onDone('Game canvas not found');
      return;
    }

    // Try to select the smallest brush size by clicking it
    const brushBtns = findBrushSizeElements();
    if (brushBtns.length > 0) {
      // Brush buttons are ordered smallest to largest
      const idx = brushSize <= 4 ? 0 : brushSize <= 10 ? 1 : brushSize <= 20 ? 2 : brushSize <= 32 ? 3 : 4;
      if (brushBtns[Math.min(idx, brushBtns.length - 1)]) {
        brushBtns[Math.min(idx, brushBtns.length - 1)].click();
      }
    }

    let currentColorId = -1;
    lastClickedColorId = -1;

    function tick() {
      if (!drawState.running) return;
      if (!canvasEl.isConnected) {
        drawState.running = false;
        if (drawState.onDone) drawState.onDone('Canvas disappeared (round ended?)');
        return;
      }
      const end = Math.min(drawState.index + chunkSize, points.length);

      for (let i = drawState.index; i < end; i++) {
        const p = points[i];
        if (p.colorId !== currentColorId) {
          clickColor(p.colorId);
          currentColorId = p.colorId;
        }
        if (!drawDotOnCanvas(canvasEl, p.x, p.y)) break;
      }

      drawState.index = end;
      if (drawState.onProgress) {
        drawState.onProgress(drawState.index, points.length);
      }

      if (drawState.index >= points.length) {
        drawState.running = false;
        if (drawState.onDone) drawState.onDone(null);
        return;
      }

      drawState.timer = setTimeout(tick, chunkDelayMs);
    }

    tick();
  }

  // ── Estimate drawing time ───────────────────────────────────────────────

  function estimateTime(pointCount, chunkSize, chunkDelayMs) {
    const ticks = Math.ceil(pointCount / chunkSize);
    return Math.round((ticks * chunkDelayMs) / 1000);
  }

  // ── Expose to global for content.js integration ─────────────────────────

  window.__skribblDrawer = {
    PALETTE,
    CANVAS_W,
    CANVAS_H,
    processImage,
    startDrawing,
    stopDrawing,
    estimateTime,
    isDrawing: () => drawState.running,
    getProgress: () => ({ index: drawState.index, total: drawState.points.length }),
  };
})();
