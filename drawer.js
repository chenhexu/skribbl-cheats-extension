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

  // Precomputed palette lookup - white (id 0) treated as transparent/skip
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
    const ctx = canvas.getContext('2d');
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
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;
    const t = threshold * threshold * 3; // squared distance to white
    for (let i = 0; i < d.length; i += 4) {
      const dr = 255 - d[i], dg = 255 - d[i + 1], db = 255 - d[i + 2];
      if (dr * dr + dg * dg + db * db < t) {
        d[i + 3] = 0; // make transparent
      }
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  function sampleToPoints(canvas, step) {
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;
    const w = canvas.width;
    const points = [];
    for (let y = 0; y < canvas.height; y += step) {
      for (let x = 0; x < w; x += step) {
        const i = (y * w + x) * 4;
        if (d[i + 3] < 128) continue; // transparent
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

  // ── Full pipeline ───────────────────────────────────────────────────────

  function processImage(img, options) {
    const { bgThreshold, density, maxPoints } = options;
    const step = Math.max(1, Math.round(11 - density)); // density 1→step 10, density 10→step 1

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

  // ── Drawing: socket path ────────────────────────────────────────────────

  let capturedSocket = null;

  function hookSocket() {
    if (capturedSocket) return;
    // Try to intercept Socket.io's emit by patching the global io or
    // finding the socket on the page. The game stores it in a minified var
    // so we hook WebSocket.prototype.send to capture the instance.
    const origSend = WebSocket.prototype.send;
    WebSocket.prototype.send = function (...args) {
      if (!capturedSocket && this.url && this.url.includes('skribbl')) {
        capturedSocket = this;
      }
      return origSend.apply(this, args);
    };
  }

  function sendDrawCommandsViaSocket(commands) {
    if (!capturedSocket || capturedSocket.readyState !== WebSocket.OPEN) return false;
    // Socket.io type 4 message with event "drawCommands"
    // Format: 42["drawCommands",[cmd1,cmd2,...]]
    const payload = '42["drawCommands",' + JSON.stringify(commands) + ']';
    capturedSocket.send(payload);
    return true;
  }

  // ── Drawing: mouse fallback ─────────────────────────────────────────────

  function findGameCanvas() {
    return document.querySelector('canvas[id*="board"]') ||
           document.querySelector('#containerBoard canvas') ||
           document.querySelector('#canvasGame') ||
           document.querySelector('canvas.board') ||
           document.querySelector('canvas');
  }

  function findColorButtons() {
    const box = document.querySelector('.containerColorbox') ||
                document.querySelector('[class*="color"]');
    if (!box) return [];
    return Array.from(box.querySelectorAll('div[style], div.color, div'));
  }

  function findBrushButtons() {
    const box = document.querySelector('.containerBrushSizes') ||
                document.querySelector('[class*="brush"]');
    if (!box) return [];
    return Array.from(box.querySelectorAll('div'));
  }

  function clickColorButton(colorId) {
    const buttons = findColorButtons();
    // The color buttons are laid out in a 2-row grid, mapping:
    // Row 1: white(0), red(4), orange(6), yellow(8), lime(10), cyan(12), blue(14), purple(16), pink(18), brown(20)
    // Row 2: black(1), dkred(5), dkorange(7), dkyellow(9), dkgreen(11), dkcyan(13), dkblue(15), dkpurple(17), dkpink(19), dkbrown(21)
    // gray(2) and dkgray(3) fit somewhere in there too.
    // We'll use the palette hex to find the closest button by background color.
    const target = PALETTE[colorId];
    if (!target) return false;
    for (const btn of buttons) {
      const bg = btn.style.backgroundColor || getComputedStyle(btn).backgroundColor;
      if (!bg) continue;
      const m = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (!m) continue;
      const r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3]);
      if (colorDistSq(r, g, b, target.r, target.g, target.b) < 100) {
        btn.click();
        return true;
      }
    }
    return false;
  }

  function simulateMouseDraw(canvasEl, x, y) {
    const rect = canvasEl.getBoundingClientRect();
    const scaleX = rect.width / CANVAS_W;
    const scaleY = rect.height / CANVAS_H;
    const cx = rect.left + x * scaleX;
    const cy = rect.top + y * scaleY;
    const opts = { bubbles: true, clientX: cx, clientY: cy };
    canvasEl.dispatchEvent(new MouseEvent('mousedown', opts));
    canvasEl.dispatchEvent(new MouseEvent('mousemove', opts));
    canvasEl.dispatchEvent(new MouseEvent('mouseup', opts));
  }

  // ── Drawing orchestrator ────────────────────────────────────────────────

  let drawState = {
    running: false,
    points: [],
    index: 0,
    timer: null,
    method: 'socket', // 'socket' or 'mouse'
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
    const { chunkSize, chunkDelayMs, brushSize, method, onProgress, onDone } = options;
    drawState.running = true;
    drawState.points = points;
    drawState.index = 0;
    drawState.method = method || 'socket';
    drawState.onProgress = onProgress || null;
    drawState.onDone = onDone || null;

    const canvasEl = (method === 'mouse') ? findGameCanvas() : null;
    if (method === 'mouse' && !canvasEl) {
      drawState.running = false;
      if (onDone) onDone('Canvas not found');
      return;
    }

    let currentColorId = -1;

    function tick() {
      if (!drawState.running) return;
      const end = Math.min(drawState.index + chunkSize, points.length);
      const cmds = [];

      for (let i = drawState.index; i < end; i++) {
        const p = points[i];
        if (drawState.method === 'socket') {
          // Pencil: [0, colorId, size, x1, y1, x2, y2] (dot = same start/end)
          cmds.push([0, p.colorId, brushSize, p.x, p.y, p.x, p.y]);
        } else {
          if (p.colorId !== currentColorId) {
            clickColorButton(p.colorId);
            currentColorId = p.colorId;
          }
          simulateMouseDraw(canvasEl, p.x, p.y);
        }
      }

      if (drawState.method === 'socket' && cmds.length > 0) {
        const sent = sendDrawCommandsViaSocket(cmds);
        if (!sent) {
          // Fallback: try mouse
          drawState.method = 'mouse';
          const cEl = findGameCanvas();
          if (!cEl) {
            drawState.running = false;
            if (drawState.onDone) drawState.onDone('Socket failed, canvas not found');
            return;
          }
          // Re-process this chunk with mouse
          for (let i = drawState.index; i < end; i++) {
            const p = points[i];
            if (p.colorId !== currentColorId) {
              clickColorButton(p.colorId);
              currentColorId = p.colorId;
            }
            simulateMouseDraw(cEl, p.x, p.y);
          }
        }
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

  hookSocket();

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
