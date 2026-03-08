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

  // Precompute LAB, chroma, hue for each palette entry
  PALETTE.forEach(c => {
    const lab = rgbToLab(c.r, c.g, c.b);
    c.L = lab.L; c.A = lab.a; c.B = lab.b;
    c.chroma = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
    c.hue = Math.atan2(lab.b, lab.a);
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

  // Hue angle difference in [-PI, PI]; wrap so difference is at most PI
  function hueDiff(h1, h2) {
    let d = h1 - h2;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
  }

  const MIN_CHROMA_FOR_HUE = 18;   // pixel chroma above this: prefer same-hue palette colors
  const PALETTE_MIN_CHROMA = 12;   // only consider palette entries with chroma above this for hue match
  const HUE_ANGLE_MARGIN = (120 * Math.PI) / 180;  // ~120° same-hue band

  function nearestColorId(r, g, b, skipWhite) {
    const pal = skipWhite ? PALETTE_NO_WHITE : PALETTE;
    const lab = rgbToLab(r, g, b);
    const chroma = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
    const hue = Math.atan2(lab.b, lab.a);

    let candidates = pal;
    if (chroma >= MIN_CHROMA_FOR_HUE) {
      const sameHue = pal.filter((c) => {
        if (c.chroma < PALETTE_MIN_CHROMA) return false;
        return Math.abs(hueDiff(hue, c.hue)) <= HUE_ANGLE_MARGIN;
      });
      if (sameHue.length > 0) candidates = sameHue;
    }

    let best = candidates[0], bestD = Infinity;
    for (let i = 0; i < candidates.length; i++) {
      const d = labDistSq(lab.L, lab.a, lab.b, candidates[i].L, candidates[i].A, candidates[i].B);
      if (d < bestD) { bestD = d; best = candidates[i]; }
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

  // BG removal: make near-white pixels transparent so they aren't drawn.
  // - threshold (0–120): pixels whose RGB is within (threshold²×3) of white (255,255,255)
  //   in squared distance become transparent. Higher = more aggressive removal.
  // - Pixels with luminance ≥ 250 are also removed (bright highlights).
  function removeBackground(canvas, threshold) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;
    const w = canvas.width;
    const t = threshold * threshold * 3;
    const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const dr = 255 - r, dg = 255 - g, db = 255 - b;
      const distSq = dr * dr + dg * dg + db * db;
      const L = lum(r, g, b);
      if (distSq < t || L >= 250) d[i + 3] = 0;
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  // Bounding box of visible pixels (alpha >= 128)
  function getContentBounds(canvas) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data, w = canvas.width, h = canvas.height;
    let xMin = w, xMax = 0, yMin = h, yMax = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (d[i + 3] >= 128) {
          if (x < xMin) xMin = x;
          if (x > xMax) xMax = x;
          if (y < yMin) yMin = y;
          if (y > yMax) yMax = y;
        }
      }
    }
    if (xMin > xMax || yMin > yMax) return null;
    return { xMin, yMin, xMax, yMax, w: xMax - xMin + 1, h: yMax - yMin + 1 };
  }

  // Crop to subject and scale to fit canvas while preserving aspect ratio (no stretching)
  function cropToContentAndScale(canvas, padding) {
    const bounds = getContentBounds(canvas);
    if (!bounds || bounds.w < 4 || bounds.h < 4) return canvas;
    const pad = Math.max(0, padding || 0);
    const sx = Math.max(0, bounds.xMin - pad);
    const sy = Math.max(0, bounds.yMin - pad);
    const sw = Math.min(canvas.width - sx, bounds.w + 2 * pad);
    const sh = Math.min(canvas.height - sy, bounds.h + 2 * pad);
    const scale = Math.min(CANVAS_W / sw, CANVAS_H / sh);
    const dw = Math.round(sw * scale);
    const dh = Math.round(sh * scale);
    const dx = Math.round((CANVAS_W - dw) / 2);
    const dy = Math.round((CANVAS_H - dh) / 2);
    const out = document.createElement('canvas');
    out.width = CANVAS_W;
    out.height = CANVAS_H;
    const ctx = out.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.drawImage(canvas, sx, sy, sw, sh, dx, dy, dw, dh);
    return out;
  }

  // Measure color variance over visible pixels (luminance range 0..255)
  function measureColorVariance(canvas) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;
    let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
    let count = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue;
      count++;
      if (d[i] < rMin) rMin = d[i];
      if (d[i] > rMax) rMax = d[i];
      if (d[i + 1] < gMin) gMin = d[i + 1];
      if (d[i + 1] > gMax) gMax = d[i + 1];
      if (d[i + 2] < bMin) bMin = d[i + 2];
      if (d[i + 2] > bMax) bMax = d[i + 2];
    }
    const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
    const lMin = lum(rMin, gMin, bMin), lMax = lum(rMax, gMax, bMax);
    const luminanceRange = lMax - lMin;
    const channelRange = Math.max(rMax - rMin, gMax - gMin, bMax - bMin);
    return { count, luminanceRange, channelRange, rMin, rMax, gMin, gMax, bMin, bMax };
  }

  // Stretch contrast so visible pixels use full 0–255 range; improves recognition for low-contrast images
  function enhanceLowContrast(canvas) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;
    let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue;
      if (d[i] < rMin) rMin = d[i];
      if (d[i] > rMax) rMax = d[i];
      if (d[i + 1] < gMin) gMin = d[i + 1];
      if (d[i + 1] > gMax) gMax = d[i + 1];
      if (d[i + 2] < bMin) bMin = d[i + 2];
      if (d[i + 2] > bMax) bMax = d[i + 2];
    }
    const rSpan = rMax - rMin || 1, gSpan = gMax - gMin || 1, bSpan = bMax - bMin || 1;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue;
      d[i] = Math.max(0, Math.min(255, Math.round((d[i] - rMin) * 255 / rSpan)));
      d[i + 1] = Math.max(0, Math.min(255, Math.round((d[i + 1] - gMin) * 255 / gSpan)));
      d[i + 2] = Math.max(0, Math.min(255, Math.round((d[i + 2] - bMin) * 255 / bSpan)));
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

  // ── Path ordering: spatial clusters, then fill by rows within each ─────
  // Groups by color (back-to-front). Within each color, builds spatially
  // coherent chains so we never draw across disconnected regions. Then
  // fills each chain row-by-row (sort by y, x); splits row on x-gap so we
  // don't draw across holes (e.g. rim vs tire). Output order avoids merging
  // across gaps so interior fills with 1 stroke per line.

  const CLUSTER_JOIN_DIST_SQ = 3600;  // max dist^2 to add to same chain (~60px)
  const DIAGONAL_PENALTY = 800;       // favors axis-aligned next point over diagonal
  const ROW_TOL = 4;                  // same row for fill
  const X_GAP = 30;                   // gap (px) on same row → new run (avoid cross-hole stroke)

  function orderPointsByPath(points, alphaData, alphaW, alphaH) {
    if (points.length <= 1) return points;

    const groupMap = new Map();
    for (let i = 0; i < points.length; i++) {
      const cId = points[i].colorId;
      if (!groupMap.has(cId)) groupMap.set(cId, []);
      groupMap.get(cId).push(points[i]);
    }

    const result = [];
    const entries = Array.from(groupMap.entries());
    entries.sort((a, b) => {
      const idA = a[0], idB = b[0];
      if (idA === 0) return 1;
      if (idB === 0) return -1;
      return idB - idA;
    });
    for (const [, group] of entries) {
      if (group.length <= 2) {
        group.forEach(p => result.push(p));
        continue;
      }
      const used = new Uint8Array(group.length);
      let left = group.length;
      while (left > 0) {
        let startIdx = -1;
        for (let j = 0; j < group.length; j++) {
          if (!used[j]) { startIdx = j; break; }
        }
        if (startIdx === -1) break;
        const chain = [group[startIdx]];
        used[startIdx] = 1;
        left--;
        let cx = group[startIdx].x, cy = group[startIdx].y;
        for (;;) {
          let bestIdx = -1, bestScore = Infinity;
          for (let j = 0; j < group.length; j++) {
            if (used[j]) continue;
            const dx = group[j].x - cx, dy = group[j].y - cy;
            const d = dx * dx + dy * dy;
            if (d > CLUSTER_JOIN_DIST_SQ) continue;
            const axisPenalty = Math.min(dx * dx, dy * dy);
            const score = d + DIAGONAL_PENALTY * Math.min(1, axisPenalty / 400);
            if (score < bestScore) { bestScore = score; bestIdx = j; }
          }
          if (bestIdx === -1) break;
          used[bestIdx] = 1;
          left--;
          chain.push(group[bestIdx]);
          cx = group[bestIdx].x;
          cy = group[bestIdx].y;
        }
        // Fill this cluster by rows; split row on x-gap so we don't stroke across holes
        chain.sort((a, b) => (a.y !== b.y) ? a.y - b.y : a.x - b.x);
        const runs = [];
        let runIndex = 0;
        let rowY = null;
        let currentRun = [];
        let prev = null;
        for (let k = 0; k < chain.length; k++) {
          const p = chain[k];
          const newRow = prev && Math.abs(p.y - prev.y) > ROW_TOL;
          const gap = prev && !newRow && (p.x - prev.x) > X_GAP;
          const crossesTransparent = prev && alphaData && alphaW && alphaH &&
            lineCrossesTransparent(alphaData, alphaW, alphaH, prev.x, prev.y, p.x, p.y);
          if (prev && (newRow || gap || crossesTransparent)) {
            runs.push({ rowY, runIndex, points: currentRun });
            currentRun = [];
            runIndex = newRow ? 0 : runIndex + 1;
          }
          currentRun.push(p);
          rowY = p.y;
          prev = p;
        }
        if (currentRun.length) runs.push({ rowY, runIndex, points: currentRun });
        runs.sort((a, b) => (a.runIndex !== b.runIndex) ? a.runIndex - b.runIndex : a.rowY - b.rowY);
        runs.forEach(r => r.points.forEach(p => result.push(p)));
      }
    }
    return result;
  }

  // Luminance range (0–255) below which we treat the image as low-contrast and boost it
  const LOW_CONTRAST_LUMINANCE_RANGE = 72;

  function processImage(img, options) {
    const { bgThreshold, density, maxPoints, useWhite, skipDrawWhite } = options;
    const skipWhite = useWhite === false;
    const skipWhiteDraw = skipDrawWhite !== false;
    const step = Math.max(1, Math.round(8 - density));  // finer step = more points, sharper result
    let canvas = resizeImageToCanvas(img);
    if (bgThreshold > 0) {
      canvas = removeBackground(canvas, bgThreshold);
      canvas = cropToContentAndScale(canvas, 8);
    }
    let contrastBoosted = false;
    const variance = measureColorVariance(canvas);
    if (variance.count > 0 && variance.luminanceRange < LOW_CONTRAST_LUMINANCE_RANGE) {
      enhanceLowContrast(canvas);
      contrastBoosted = true;
    }
    let points = sampleToPoints(canvas, step, skipWhite);
    points.sort((a, b) => b.colorId - a.colorId);
    let alphaData = null, alphaW = 0, alphaH = 0;
    try {
      const imgData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      alphaData = imgData.data;
      alphaW = canvas.width;
      alphaH = canvas.height;
    } catch (_) {}
    points = orderPointsByPath(points, alphaData, alphaW, alphaH);
    if (skipWhiteDraw) points = points.filter(p => p.colorId !== 0);
    if (maxPoints > 0 && points.length > maxPoints) points = downsamplePoints(points, maxPoints);
    return { canvas, points, contrastBoosted };
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

  const EXTENSION_INVALIDATED_MSG = 'Extension was reloaded or disabled. Refresh the skribbl.io page and try again.';
  const SEND_RETRY_DELAY_MS = 600;
  const SEND_RETRY_MAX = 3;

  function sendToBg(msg, retriesLeft) {
    if (retriesLeft === undefined) retriesLeft = SEND_RETRY_MAX;
    return new Promise((resolve, reject) => {
      try {
        if (!chrome.runtime?.id) {
          reject(new Error(EXTENSION_INVALIDATED_MSG));
          return;
        }
        chrome.runtime.sendMessage(msg, (resp) => {
          if (chrome.runtime.lastError) {
            const errMsg = chrome.runtime.lastError.message || '';
            const isConnectionError = /Receiving end does not exist|Could not establish connection|Extension context invalidated/i.test(errMsg);
            if (isConnectionError && retriesLeft > 0) {
              setTimeout(() => {
                sendToBg(msg, retriesLeft - 1).then(resolve).catch(reject);
              }, SEND_RETRY_DELAY_MS);
              return;
            }
            reject(new Error(errMsg || EXTENSION_INVALIDATED_MSG));
            return;
          }
          resolve(resp || { ok: false, error: 'no response' });
        });
      } catch (e) {
        reject(new Error((e && e.message) || EXTENSION_INVALIDATED_MSG));
      }
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
    let index = 0;
    const docs = getDocumentsToSearch();
    for (let di = 0; di < docs.length; di++) {
      const doc = docs[di];
      const all = doc.querySelectorAll('canvas');
      all.forEach(function (c) {
        const rect = c.getBoundingClientRect();
        const style = (doc.defaultView && doc.defaultView.getComputedStyle(c)) || getComputedStyle(c);
        const visible = rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
        out.push({
          index: index++, width: c.width, height: c.height,
          displayWidth: Math.round(rect.width), displayHeight: Math.round(rect.height),
          top: Math.round(rect.top), left: Math.round(rect.left),
          id: c.id || '(no id)',
          className: (c.className && typeof c.className === 'string') ? c.className : '(none)',
          visible: visible, el: c,
        });
      });
    }
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

  function getDocumentsToSearch() {
    const docs = [document];
    try {
      const iframes = document.querySelectorAll('iframe');
      for (let i = 0; i < iframes.length; i++) {
        try {
          const d = iframes[i].contentDocument;
          if (d && d !== document) docs.push(d);
        } catch (e) {}
      }
    } catch (e) {}
    return docs;
  }

  function queryAllRootsInDoc(doc, selector) {
    const out = [];
    try {
      doc.querySelectorAll(selector).forEach(el => out.push(el));
    } catch (e) {}
    function walk(root) {
      if (!root || !root.querySelectorAll) return;
      try {
        root.querySelectorAll(selector).forEach(el => out.push(el));
      } catch (e) {}
      try {
        root.querySelectorAll('*').forEach(el => { if (el.shadowRoot) walk(el.shadowRoot); });
      } catch (e) {}
    }
    walk(doc);
    return out;
  }

  function queryAllRoots(selector) {
    return queryAllRootsInDoc(document, selector);
  }

  function parseRgbFromStyle(bg) {
    if (!bg) return null;
    const rgb = bg.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
    if (rgb) return { r: +rgb[1], g: +rgb[2], b: +rgb[3] };
    const hex = bg.match(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/);
    if (hex) {
      const h = hex[1].length === 3
        ? hex[1].replace(/(.)/g, '$1$1')
        : hex[1];
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
      };
    }
    return null;
  }

  function findColorElementsInDoc(doc) {
    const seen = new Set();
    const out = [];
    function add(el) { if (el && !seen.has(el)) { seen.add(el); out.push(el); } }
    queryAllRootsInDoc(doc, '.colorItem').forEach(add);
    const boxSelectors = ['.containerColorbox', '[class*="colorbox"]', '#containerBoard [class*="color"]', '[class*="Colorbox"]'];
    let box = null;
    for (const sel of boxSelectors) {
      const els = queryAllRootsInDoc(doc, sel);
      for (const el of els) {
        if (el && el.querySelectorAll) { box = el; break; }
      }
      if (box) break;
    }
    if (box && out.length === 0) {
      Array.from(box.querySelectorAll('div')).filter(d => {
        const bg = d.style.backgroundColor || getComputedStyle(d).backgroundColor || '';
        return bg.startsWith('rgb') || /#[0-9a-fA-F]{3,6}/.test(bg);
      }).forEach(add);
    }
    if (out.length === 0) {
      const candidates = queryAllRootsInDoc(doc, 'div[style*="background"], [class*="color"] div, [class*="Color"] div');
      for (const d of candidates) {
        const rect = d.getBoundingClientRect();
        if (rect.width < 8 || rect.width > 70 || rect.height < 8 || rect.height > 70) continue;
        const bg = d.style.backgroundColor || getComputedStyle(d).backgroundColor;
        if (bg && (bg.startsWith('rgb') || /#[0-9a-fA-F]{3,6}/.test(bg))) add(d);
      }
    }
    return out;
  }

  function findColorElements() {
    const docs = getDocumentsToSearch();
    for (let i = 0; i < docs.length; i++) {
      const out = findColorElementsInDoc(docs[i]);
      if (out.length > 0) return out;
    }
    return [];
  }

  function findBrushSizeElementsInDoc(doc) {
    const selectors = [
      '.containerBrushSizes div', '.containerBrushSizes button',
      '[class*="BrushSize"] div', '[class*="brushSize"] div', '[class*="brush"] div',
      '#containerBoard [class*="brush"] div', '#containerBoard [class*="Brush"] div',
      '.containerToolbar [class*="brush"] div',
    ];
    for (const sel of selectors) {
      const list = queryAllRootsInDoc(doc, sel);
      const filtered = list.filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 4 && r.height > 4 && r.width < 80 && r.height < 80;
      });
      if (filtered.length > 0) return filtered;
    }
    return [];
  }

  function findBrushSizeElements() {
    const docs = getDocumentsToSearch();
    for (let i = 0; i < docs.length; i++) {
      const out = findBrushSizeElementsInDoc(docs[i]);
      if (out.length > 0) return out;
    }
    return [];
  }

  // ── Viewport coordinate helpers ─────────────────────────────────────────
  // CDP Input.dispatchMouseEvent uses viewport (layout viewport) coordinates.
  // Map our 800x600 space to the game canvas display rect; round to integers
  // so the game receives consistent pixel positions and drawing stays precise.

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
  let usedIndexFallback = false;

  async function clickColorCDP(colorId, logFn) {
    if (colorId === lastClickedColorId) return;
    const target = PALETTE[colorId];
    if (!target) return;
    const colorEls = findColorElements();
    let bestBtn = null, bestD = Infinity;
    for (const btn of colorEls) {
      const bg = btn.style.backgroundColor || getComputedStyle(btn).backgroundColor;
      const rgb = parseRgbFromStyle(bg);
      if (!rgb) continue;
      const lab = rgbToLab(rgb.r, rgb.g, rgb.b);
      const d = labDistSq(lab.L, lab.a, lab.b, target.L, target.A, target.B);
      if (d < bestD) { bestD = d; bestBtn = btn; }
    }
    if (bestBtn && bestD < 1800) {
      const c = elementCenter(bestBtn);
      await debuggerClickAt(c.x, c.y);
      await delay(80);
      lastClickedColorId = colorId;
      return;
    }
    if (colorEls.length >= 11 && colorId >= 0 && colorId < colorEls.length) {
      const btn = colorEls[colorId];
      const c = elementCenter(btn);
      await debuggerClickAt(c.x, c.y);
      await delay(80);
      lastClickedColorId = colorId;
      if (!usedIndexFallback && logFn) {
        usedIndexFallback = true;
        logFn('clickColorCDP: using palette index fallback (colorEls=' + colorEls.length + ')');
      }
      return;
    }
    if (logFn) logFn('clickColorCDP: no match for colorId=' + colorId + ' (colorEls=' + colorEls.length + ')');
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
    keepAlivePort: null,
  };

  function stopDrawing() {
    drawState.running = false;
    if (drawState.timer) { clearTimeout(drawState.timer); drawState.timer = null; }
    if (drawState.keepAlivePort) {
      try { drawState.keepAlivePort.disconnect(); } catch (_) {}
      drawState.keepAlivePort = null;
    }
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
    const drawPromise = (async () => {
      try {
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
          if (chrome.runtime?.id) {
            try {
              drawState.keepAlivePort = chrome.runtime.connect({ name: 'drawKeepAlive' });
            } catch (_) {}
          }
          await clickBrushSizeCDP(brushSize, logFn);
          lastClickedColorId = -1;
          usedIndexFallback = false;
          await runCDPLoop(points, canvasEl, chunkSize, chunkDelayMs, brushSize, logFn, options.processedCanvas || null);
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
      } catch (e) {
        drawState.running = false;
        if (drawState.keepAlivePort) {
          try { drawState.keepAlivePort.disconnect(); } catch (_) {}
          drawState.keepAlivePort = null;
        }
        const msg = (e && e.message) || String(e);
        logFn('Draw: ' + msg);
        if (onDone) onDone(msg);
      }
    })();
    drawPromise.catch((e) => {
      drawState.running = false;
      if (drawState.keepAlivePort) {
        try { drawState.keepAlivePort.disconnect(); } catch (_) {}
        drawState.keepAlivePort = null;
      }
      const msg = (e && e.message) || String(e);
      logFn('Draw: ' + msg);
      if (onDone) onDone(msg);
    });
  }

  // Max distance to connect two consecutive points as a stroke (game coords)
  const MAX_STROKE_DIST = 85;
  const MAX_LINE_LENGTH = 280;
  const STROKE_SETTLE_MS = 12;
  const AXIS_TOL = 4;

  function distPointToLineSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-6) return Math.hypot(px - ax, py - ay);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    const qx = ax + t * dx, qy = ay + t * dy;
    return Math.hypot(px - qx, py - qy);
  }

  function distPointToLine(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-6) return Math.hypot(px - ax, py - ay);
    const t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    const qx = ax + t * dx, qy = ay + t * dy;
    return Math.hypot(px - qx, py - qy);
  }

  // Returns true if any pixel on the line (x1,y1)->(x2,y2) has alpha < 128 in the processed image.
  // Used to avoid drawing strokes across transparent areas (only draw where the original has color).
  function lineCrossesTransparent(data, w, h, x1, y1, x2, y2) {
    const ix1 = Math.round(x1), iy1 = Math.round(y1), ix2 = Math.round(x2), iy2 = Math.round(y2);
    const dx = Math.abs(ix2 - ix1), dy = Math.abs(iy2 - iy1);
    const steps = Math.max(dx, dy, 1);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = Math.round(ix1 + t * (ix2 - ix1));
      const y = Math.round(iy1 + t * (iy2 - iy1));
      const cx = Math.max(0, Math.min(w - 1, x));
      const cy = Math.max(0, Math.min(h - 1, y));
      if (data[(cy * w + cx) * 4 + 3] < 128) return true;
    }
    return false;
  }

  // CDP draw loop: uses strokes for nearby same-color points; merges collinear points into one stroke
  async function runCDPLoop(points, canvasEl, chunkSize, chunkDelayMs, brushSize, logFn, processedCanvas) {
    let currentColorId = -1;
    let chunkCount = 0;
    let strokeCount = 0, dotCount = 0;

    let alphaData = null;
    let alphaW = 0, alphaH = 0;
    if (processedCanvas && processedCanvas.width && processedCanvas.height) {
      try {
        const ctx = processedCanvas.getContext('2d');
        const imgData = ctx.getImageData(0, 0, processedCanvas.width, processedCanvas.height);
        alphaData = imgData.data;
        alphaW = processedCanvas.width;
        alphaH = processedCanvas.height;
      } catch (_) {}
    }

    function finish(reason, err) {
      drawState.running = false;
      if (drawState.timer) { clearTimeout(drawState.timer); drawState.timer = null; }
      if (drawState.keepAlivePort) {
        try { drawState.keepAlivePort.disconnect(); } catch (_) {}
        drawState.keepAlivePort = null;
      }
      if (reason) logFn('Draw: ' + reason);
      if (drawState.onDone) drawState.onDone(err || null);
    }

    // Set first point's color before any drawing so the first stroke uses it
    if (points.length > 0) {
      await clickColorCDP(points[0].colorId, logFn);
      currentColorId = points[0].colorId;
      await delay(120);
    }

    async function tick() {
      if (!drawState.running) return;
      if (!canvasEl.isConnected) {
        finish('canvas removed (e.g. round ended)');
        return;
      }

      const end = Math.min(drawState.index + chunkSize, points.length);

      try {
        for (let i = drawState.index; i < end; i++) {
          if (!drawState.running) return;
          const p = points[i];
          if (p.colorId !== currentColorId) {
            await clickColorCDP(p.colorId, null);
            currentColorId = p.colorId;
          }

          if (i + 1 < end && points[i + 1].colorId === p.colorId) {
            const np = points[i + 1];
            const dx = np.x - p.x, dy = np.y - p.y;
            const distSq = dx * dx + dy * dy;
            const isHorizontal = Math.abs(dy) <= AXIS_TOL && distSq <= MAX_STROKE_DIST * MAX_STROKE_DIST;
            const isVertical = Math.abs(dx) <= AXIS_TOL && distSq <= MAX_STROKE_DIST * MAX_STROKE_DIST;
            if (isHorizontal || isVertical) {
              let last = i + 1;
              for (let j = i + 2; j < end && points[j].colorId === p.colorId; j++) {
                const jdist = Math.hypot(points[j].x - p.x, points[j].y - p.y);
                if (jdist > MAX_LINE_LENGTH) break;
                const jx = points[j].x - p.x, jy = points[j].y - p.y;
                const onAxis = isHorizontal
                  ? Math.abs(points[j].y - p.y) <= AXIS_TOL
                  : Math.abs(points[j].x - p.x) <= AXIS_TOL;
                if (!onAxis) break;
                const lx = points[last].x - p.x, ly = points[last].y - p.y;
                const lenSq = lx * lx + ly * ly;
                const t = lenSq > 1e-6 ? (jx * lx + jy * ly) / lenSq : 0;
                if (t >= 0.98) last = j;
                else break;
              }
              const crossesTransparent = alphaData && lineCrossesTransparent(alphaData, alphaW, alphaH, p.x, p.y, points[last].x, points[last].y);
              if (!crossesTransparent) {
                const vp1 = gameToViewport(canvasEl, p.x, p.y);
                const vp2 = gameToViewport(canvasEl, points[last].x, points[last].y);
                await debuggerDrawStroke(vp1.x, vp1.y, vp2.x, vp2.y);
                if (STROKE_SETTLE_MS > 0) await delay(STROKE_SETTLE_MS);
                strokeCount++;
                i = last;
                continue;
              }
            }
          }

          const vp = gameToViewport(canvasEl, p.x, p.y);
          await debuggerDrawDot(vp.x, vp.y);
          dotCount++;
        }
      } catch (e) {
        finish('CDP error: ' + (e && e.message ? e.message : String(e)), e);
        return;
      }

      chunkCount++;
      if (chunkCount === 1) logFn('Draw: first CDP chunk done');

      drawState.index = end;
      if (drawState.onProgress) drawState.onProgress(drawState.index, points.length);

      if (drawState.index >= points.length) {
        logFn('Draw: finished via CDP, points=' + points.length + ', strokes=' + strokeCount + ', dots=' + dotCount + ', chunks=' + chunkCount);
        finish();
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
