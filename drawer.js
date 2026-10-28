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

  // ── Imitate pipeline: Outline → Major shapes → Details → Fill/Shading ─────
  const IMITATE_OUTLINE_STEP = 5;
  const IMITATE_EDGE_ALPHA_THRESHOLD = 128;
  const IMITATE_BORDER_MARGIN = 6;
  const IMITATE_EDGE_LUMA_DIFF = 40;

  function luminance(r, g, b) {
    return (0.299 * r + 0.587 * g + 0.114 * b) | 0;
  }

  function isEdgePixel(d, w, h, x, y) {
    const i = (y * w + x) * 4;
    if (d[i + 3] < IMITATE_EDGE_ALPHA_THRESHOLD) return false;
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const L = luminance(r, g, b);
    const dx = [0, 1, 0, -1], dy = [1, 0, -1, 0];
    for (let k = 0; k < 4; k++) {
      const nx = x + dx[k], ny = y + dy[k];
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) return true;
      const ni = (ny * w + nx) * 4;
      if (d[ni + 3] < IMITATE_EDGE_ALPHA_THRESHOLD) return true;
      const dL = Math.abs(L - luminance(d[ni], d[ni + 1], d[ni + 2]));
      if (dL >= IMITATE_EDGE_LUMA_DIFF) return true;
    }
    return false;
  }

  // Quadratic Bezier: B(t) = (1-t)^2 P0 + 2(1-t)t P1 + t^2 P2. Sample at t in [0,1].
  function quadraticBezierPoint(p0x, p0y, p1x, p1y, p2x, p2y, t) {
    const u = 1 - t;
    return {
      x: u * u * p0x + 2 * u * t * p1x + t * t * p2x,
      y: u * u * p0y + 2 * u * t * p1y + t * t * p2y,
    };
  }

  // Smooth a chain of points with quadratic Bezier: each segment becomes a curve; use many samples for actual curves.
  function smoothOutlineWithBezier(points, colorId, samplesPerSegment) {
    if (points.length < 3) return points;
    const out = [];
    const segLen = 3;
    const n = samplesPerSegment || 12;
    for (let i = 0; i < points.length; i += segLen) {
      const end = Math.min(i + segLen + 1, points.length);
      const seg = points.slice(i, end);
      if (seg.length < 2) {
        seg.forEach(p => out.push({ x: p.x, y: p.y, colorId }));
        continue;
      }
      const p0 = seg[0], p2 = seg[seg.length - 1];
      const mid = seg[Math.floor(seg.length / 2)];
      const perpScale = 0.15;
      const dx = p2.x - p0.x, dy = p2.y - p0.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const p1x = mid.x + nx * len * perpScale;
      const p1y = mid.y + ny * len * perpScale;
      for (let k = 0; k < n; k++) {
        const t = k / n;
        const pt = quadraticBezierPoint(p0.x, p0.y, p1x, p1y, p2.x, p2.y, t);
        out.push({ x: Math.round(pt.x), y: Math.round(pt.y), colorId });
      }
      if (end >= points.length) out.push({ x: p2.x, y: p2.y, colorId });
    }
    return out;
  }

  // Row-based zigzag fill: sort by y (row), alternate x direction per row (left-right / right-left).
  const IMITATE_ROW_TOL = 8;
  function orderPointsByPathImitate(points, alphaData, alphaW, alphaH) {
    if (points.length <= 1) return points;
    const groupMap = new Map();
    for (let i = 0; i < points.length; i++) {
      const cId = points[i].colorId;
      if (!groupMap.has(cId)) groupMap.set(cId, []);
      groupMap.get(cId).push(points[i]);
    }
    const result = [];
    const entries = Array.from(groupMap.entries());
    entries.sort((a, b) => (b[0] === 0 ? 1 : 0) - (a[0] === 0 ? 1 : 0) || b[0] - a[0]);
    for (const [, group] of entries) {
      if (group.length <= 2) {
        group.forEach(p => result.push(p));
        continue;
      }
      // Group by row (y bucket)
      const rowMap = new Map();
      group.forEach(p => {
        const rowKey = Math.floor(p.y / IMITATE_ROW_TOL);
        if (!rowMap.has(rowKey)) rowMap.set(rowKey, []);
        rowMap.get(rowKey).push(p);
      });
      const rowKeys = Array.from(rowMap.keys()).sort((a, b) => a - b);
      rowKeys.forEach((rowKey, rowIndex) => {
        const rowPoints = rowMap.get(rowKey);
        rowPoints.sort((a, b) => (rowIndex % 2 === 0 ? a.x - b.x : b.x - a.x));
        result.push(...rowPoints);
      });
    }
    return result;
  }

  function processImageImitate(canvas, options) {
    const skipWhite = options.useWhite === false;
    const skipWhiteDraw = options.skipDrawWhite !== false;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data, w = canvas.width, h = canvas.height;
    const outlineColorId = 1;

    const outlinePoints = [];
    for (let y = 0; y < h; y += IMITATE_OUTLINE_STEP) {
      for (let x = 0; x < w; x += IMITATE_OUTLINE_STEP) {
        if (x < IMITATE_BORDER_MARGIN || x >= w - IMITATE_BORDER_MARGIN || y < IMITATE_BORDER_MARGIN || y >= h - IMITATE_BORDER_MARGIN) continue;
        if (!isEdgePixel(d, w, h, x, y)) continue;
        const i = (y * w + x) * 4;
        if (d[i + 3] < IMITATE_EDGE_ALPHA_THRESHOLD) continue;
        if (skipWhite) {
          const cId = nearestColorId(d[i], d[i + 1], d[i + 2], true);
          if (cId === 0) continue;
          outlinePoints.push({ x, y, colorId: cId });
        } else {
          outlinePoints.push({ x, y, colorId: outlineColorId });
        }
      }
    }

    // Chain outline by color, then smooth with quadratic Bezier; build curve segments for CDP
    const outlineByColor = new Map();
    outlinePoints.forEach(p => {
      if (!outlineByColor.has(p.colorId)) outlineByColor.set(p.colorId, []);
      outlineByColor.get(p.colorId).push({ x: p.x, y: p.y, colorId: p.colorId });
    });
    const outlineCurveSegments = [];
    const CURVE_SEGMENT_POINTS = 24;
    const MAX_CHAIN_JUMP_SQ = 55 * 55;
    outlineByColor.forEach((pts, cId) => {
      if (pts.length < 2) return;
      const used = new Uint8Array(pts.length);
      while (true) {
        let startIdx = -1;
        for (let j = 0; j < pts.length; j++) {
          if (!used[j]) { startIdx = j; break; }
        }
        if (startIdx === -1) break;
        const chain = [pts[startIdx]];
        used[startIdx] = 1;
        let cx = pts[startIdx].x, cy = pts[startIdx].y;
        for (;;) {
          let best = -1, bestD = Infinity;
          for (let j = 0; j < pts.length; j++) {
            if (used[j]) continue;
            const dist = (pts[j].x - cx) ** 2 + (pts[j].y - cy) ** 2;
            if (dist < bestD && dist <= MAX_CHAIN_JUMP_SQ) { bestD = dist; best = j; }
          }
          if (best === -1) break;
          used[best] = 1;
          chain.push(pts[best]);
          cx = pts[best].x;
          cy = pts[best].y;
        }
        if (chain.length < 2) continue;
        const smoothed = smoothOutlineWithBezier(chain, cId, 12);
        for (let i = 0; i < smoothed.length; i += CURVE_SEGMENT_POINTS) {
          const segment = smoothed.slice(i, Math.min(i + CURVE_SEGMENT_POINTS, smoothed.length));
          if (segment.length >= 2) {
            outlineCurveSegments.push({ colorId: cId, points: segment });
          }
        }
      }
    });

    // Imitate = outline only (one stroke per shape, no zigzag fill). No interior points.
    const points = [];
    return { points, curveSegments: outlineCurveSegments };
  }

  // ── Line-art / Canny pipeline: binary edge map → chains → Bezier → curveSegments ─────
  const IMITATE_EDGE_STEP = 3;
  const CURVE_SEGMENT_POINTS = 24;
  const MAX_CHAIN_JUMP_SQ = 55 * 55;

  function grayscaleFromRGBA(data, w, h) {
    const out = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const j = i * 4;
      out[i] = (0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2]) | 0;
    }
    return out;
  }

  const GAUSS_5 = [2, 4, 5, 4, 2, 4, 9, 12, 9, 4, 5, 12, 15, 12, 5, 4, 9, 12, 9, 4, 2, 4, 5, 4, 2];
  const GAUSS_5_SUM = 159;
  function gaussianBlurGray(data, w, h) {
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0, weight = 0;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const nx = Math.max(0, Math.min(w - 1, x + dx));
            const ny = Math.max(0, Math.min(h - 1, y + dy));
            const k = (dy + 2) * 5 + (dx + 2);
            sum += data[ny * w + nx] * GAUSS_5[k];
            weight += GAUSS_5[k];
          }
        }
        out[y * w + x] = (sum / weight) | 0;
      }
    }
    return out;
  }

  const SOBEL_X = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const SOBEL_Y = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  function sobelGray(data, w, h) {
    const mag = new Float32Array(w * h);
    const dir = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let gx = 0, gy = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const v = data[(y + dy) * w + (x + dx)];
            const k = (dy + 1) * 3 + (dx + 1);
            gx += v * SOBEL_X[k];
            gy += v * SOBEL_Y[k];
          }
        }
        const i = y * w + x;
        mag[i] = Math.sqrt(gx * gx + gy * gy);
        dir[i] = Math.atan2(gy, gx);
      }
    }
    return { mag, dir };
  }

  function nonMaxSuppression(mag, dir, w, h) {
    const out = new Uint8Array(w * h);
    const toAngle = (rad) => ((rad * 180 / Math.PI) + 180) % 180;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const m = mag[i];
        const angle = toAngle(dir[i]);
        let n1, n2;
        if (angle < 22.5 || angle >= 157.5) {
          n1 = mag[y * w + (x - 1)]; n2 = mag[y * w + (x + 1)];
        } else if (angle < 67.5) {
          n1 = mag[(y - 1) * w + (x + 1)]; n2 = mag[(y + 1) * w + (x - 1)];
        } else if (angle < 112.5) {
          n1 = mag[(y - 1) * w + x]; n2 = mag[(y + 1) * w + x];
        } else {
          n1 = mag[(y - 1) * w + (x - 1)]; n2 = mag[(y + 1) * w + (x + 1)];
        }
        out[i] = (m >= n1 && m >= n2) ? Math.min(255, m) : 0;
      }
    }
    return out;
  }

  function doubleThreshold(data, w, h, low, high) {
    const out = new Uint8Array(w * h);
    const STRONG = 255;
    const WEAK = 64;
    for (let i = 0; i < w * h; i++) {
      const v = data[i];
      out[i] = v >= high ? STRONG : v >= low ? WEAK : 0;
    }
    return out;
  }

  function hysteresisEdge(data, w, h) {
    const out = new Uint8Array(data);
    const STRONG = 255, WEAK = 64;
    const dx = [-1, 0, 1, -1, 1, -1, 0, 1];
    const dy = [-1, -1, -1, 0, 0, 1, 1, 1];
    let changed = true;
    while (changed) {
      changed = false;
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          if (out[i] !== WEAK) continue;
          for (let k = 0; k < 8; k++) {
            if (out[(y + dy[k]) * w + (x + dx[k])] === STRONG) {
              out[i] = STRONG;
              changed = true;
              break;
            }
          }
        }
      }
    }
    for (let i = 0; i < w * h; i++) if (out[i] === WEAK) out[i] = 0;
    return out;
  }

  // Binary edge map (0 = non-edge, non-zero = edge) → outline points on grid, then chain + Bezier → curveSegments.
  function binaryToCurveSegments(binaryData, w, h, borderMargin) {
    const margin = borderMargin != null ? borderMargin : IMITATE_BORDER_MARGIN;
    const step = IMITATE_EDGE_STEP;
    const outlinePoints = [];
    const outlineColorId = 1;
    for (let y = margin; y < h - margin; y += step) {
      for (let x = margin; x < w - margin; x += step) {
        if (!binaryData[y * w + x]) continue;
        outlinePoints.push({ x, y, colorId: outlineColorId });
      }
    }
    if (outlinePoints.length < 2) return [];
    const used = new Uint8Array(outlinePoints.length);
    const curveSegments = [];
    while (true) {
      let startIdx = -1;
      for (let j = 0; j < outlinePoints.length; j++) {
        if (!used[j]) { startIdx = j; break; }
      }
      if (startIdx === -1) break;
      const chain = [outlinePoints[startIdx]];
      used[startIdx] = 1;
      let cx = outlinePoints[startIdx].x, cy = outlinePoints[startIdx].y;
      for (;;) {
        let best = -1, bestD = Infinity;
        for (let j = 0; j < outlinePoints.length; j++) {
          if (used[j]) continue;
          const dist = (outlinePoints[j].x - cx) ** 2 + (outlinePoints[j].y - cy) ** 2;
          if (dist < bestD && dist <= MAX_CHAIN_JUMP_SQ) { bestD = dist; best = j; }
        }
        if (best === -1) break;
        used[best] = 1;
        chain.push(outlinePoints[best]);
        cx = outlinePoints[best].x;
        cy = outlinePoints[best].y;
      }
      if (chain.length < 2) continue;
      const smoothed = smoothOutlineWithBezier(chain, outlineColorId, 12);
      for (let i = 0; i < smoothed.length; i += CURVE_SEGMENT_POINTS) {
        const segment = smoothed.slice(i, Math.min(i + CURVE_SEGMENT_POINTS, smoothed.length));
        if (segment.length >= 2) curveSegments.push({ colorId: outlineColorId, points: segment });
      }
    }
    return curveSegments;
  }

  // Imitate from Canny/Sobel edges (photo → grayscale → blur → Sobel → [Canny] → binary → curveSegments).
  function processImageImitateFromEdges(canvas, options) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data, w = canvas.width, h = canvas.height;
    const useCanny = options.imitateUseCanny !== false;
    const lowThresh = options.edgeLowThresh != null ? options.edgeLowThresh : 30;
    const highThresh = options.edgeHighThresh != null ? options.edgeHighThresh : 80;

    const gray = grayscaleFromRGBA(d, w, h);
    const blurred = gaussianBlurGray(gray, w, h);
    const { mag, dir } = sobelGray(blurred, w, h);

    let binary;
    if (useCanny) {
      const nonMax = nonMaxSuppression(mag, dir, w, h);
      binary = doubleThreshold(nonMax, w, h, lowThresh, highThresh);
      binary = hysteresisEdge(binary, w, h);
    } else {
      binary = new Uint8Array(w * h);
      const thresh = options.edgeSobelThresh != null ? options.edgeSobelThresh : 50;
      for (let i = 0; i < w * h; i++) binary[i] = mag[i] >= thresh ? 255 : 0;
    }

    const curveSegments = binaryToCurveSegments(binary, w, h, IMITATE_BORDER_MARGIN);
    return { points: [], curveSegments };
  }

  // Imitate from line-art image (black on white): threshold grayscale → binary → curveSegments.
  function processImageImitateFromLineArt(canvas, options) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data, w = canvas.width, h = canvas.height;
    const threshold = options.lineArtThreshold != null ? options.lineArtThreshold : 128;
    const invert = options.lineArtInvert === true;

    const gray = grayscaleFromRGBA(d, w, h);
    const binary = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const ink = invert ? gray[i] >= threshold : gray[i] < threshold;
      binary[i] = ink ? 255 : 0;
    }

    const curveSegments = binaryToCurveSegments(binary, w, h, IMITATE_BORDER_MARGIN);
    return { points: [], curveSegments };
  }

  function processImage(img, options) {
    const { bgThreshold, density, maxPoints, useWhite, skipDrawWhite, style } = options;
    const skipWhite = useWhite === false;
    const skipWhiteDraw = skipDrawWhite !== false;
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

    if (style === 'imitate') {
      const subMode = options.imitateSubMode || 'photo';
      const baseOpts = { useWhite: options.useWhite, skipDrawWhite: options.skipDrawWhite, maxPoints: maxPoints || 0 };
      let points, curveSegments;
      if (subMode === 'edges') {
        const result = processImageImitateFromEdges(canvas, { ...baseOpts, imitateUseCanny: options.imitateUseCanny, edgeLowThresh: options.edgeLowThresh, edgeHighThresh: options.edgeHighThresh, edgeSobelThresh: options.edgeSobelThresh });
        points = result.points;
        curveSegments = result.curveSegments;
      } else if (subMode === 'lineart') {
        const result = processImageImitateFromLineArt(canvas, { ...baseOpts, lineArtThreshold: options.lineArtThreshold, lineArtInvert: options.lineArtInvert });
        points = result.points;
        curveSegments = result.curveSegments;
      } else {
        const result = processImageImitate(canvas, baseOpts);
        points = result.points;
        curveSegments = result.curveSegments;
      }
      return { canvas, points, contrastBoosted, curveSegments };
    }

    const step = Math.max(1, Math.round(8 - density));
    let points = sampleToPoints(canvas, step, skipWhite);
    // Draw background (low colorId) first, then foreground on top so last layer doesn't cover everything
    points.sort((a, b) => a.colorId - b.colorId);
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

  async function debuggerDrawCurve(viewportPoints) {
    return sendToBg({ action: 'drawCurve', points: viewportPoints });
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
    stopPlan().catch(() => {});
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
          await runCDPLoop(points, canvasEl, chunkSize, chunkDelayMs, brushSize, logFn, options.processedCanvas || null, options.imitateMore || false, options.imitateDelayMs || 0, options.curveSegments);
          return;
        }

        logFn('Draw: debugger unavailable, checking socket...');
        checkSocketReady((socketOk) => {
          if (socketOk) {
            drawState.method = 'socket';
            if (options.onMethod) options.onMethod('socket');
            logFn('Draw: using socket');
            runSocketLoop(points, chunkSize, chunkDelayMs, brushSize, logFn, options.imitateMore || false, options.imitateDelayMs || 0);
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
  const MAX_STROKE_DIST = 130;
  const MAX_LINE_LENGTH = 420;
  const STROKE_SETTLE_MS = 12;
  const AXIS_TOL = 2;

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

  // Wobble: add small random offset when imitateMore (human-like imperfection)
  function applyWobble(x, y, imitateMore) {
    if (!imitateMore || Math.random() >= 0.3) return { x, y };
    const d = 2;
    return {
      x: x + (Math.random() * 2 * d - d) | 0,
      y: y + (Math.random() * 2 * d - d) | 0,
    };
  }

  // Outline wobble: always add slight jitter so outlines look hand-drawn (imperfect circles, etc.)
  function applyOutlineWobble(x, y) {
    const d = 2.5;
    return {
      x: x + (Math.random() * 2 * d - d),
      y: y + (Math.random() * 2 * d - d),
    };
  }

  // CDP draw loop: uses strokes for nearby same-color points; merges collinear points into one stroke
  async function runCDPLoop(points, canvasEl, chunkSize, chunkDelayMs, brushSize, logFn, processedCanvas, imitateMore, imitateDelayMs, curveSegments) {
    let currentColorId = -1;
    let chunkCount = 0;
    let strokeCount = 0, dotCount = 0;
    let lastDrawnX = null, lastDrawnY = null;

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

    // Draw outline as multi-point curves first (CDP only), one stroke per shape, with wobble so they look hand-drawn
    if (curveSegments && curveSegments.length > 0 && canvasEl.isConnected) {
      for (const seg of curveSegments) {
        if (!drawState.running) return;
        await clickColorCDP(seg.colorId, logFn);
        currentColorId = seg.colorId;
        const viewportPoints = seg.points.map(p => {
          const wobbled = applyOutlineWobble(p.x, p.y);
          const v = gameToViewport(canvasEl, wobbled.x, wobbled.y);
          return { x: v.x, y: v.y };
        });
        await debuggerDrawCurve(viewportPoints);
        if (imitateDelayMs > 0) await delay(imitateDelayMs);
      }
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
                const w1 = applyWobble(p.x, p.y, imitateMore);
                const w2 = applyWobble(points[last].x, points[last].y, imitateMore);
                const vp1 = gameToViewport(canvasEl, w1.x, w1.y);
                const vp2 = gameToViewport(canvasEl, w2.x, w2.y);
                await debuggerDrawStroke(vp1.x, vp1.y, vp2.x, vp2.y);
                lastDrawnX = points[last].x;
                lastDrawnY = points[last].y;
                if (STROKE_SETTLE_MS > 0) await delay(STROKE_SETTLE_MS);
                strokeCount++;
                if (imitateMore && Math.random() < 0.04) {
                  try {
                    await new Promise((resolve, reject) => {
                      chrome.runtime.sendMessage({ action: 'debuggerSendKey', key: 'u' }, (r) => {
                        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                        else resolve(r);
                      });
                    });
                    await delay(150);
                  } catch (_) {}
                }
                if (imitateDelayMs > 0) await delay(imitateDelayMs);
                i = last;
                continue;
              }
            }
            // Realistic: only H and V lines when points are horizontally/vertically adjacent; otherwise dots (no diagonal strokes)
          }

          // Skip dot if same pixel as last drawn to reduce over-draw and layering mess
          const distToLast = (lastDrawnX != null && lastDrawnY != null)
            ? Math.hypot(p.x - lastDrawnX, p.y - lastDrawnY) : Infinity;
          if (distToLast >= 2) {
            const w = applyWobble(p.x, p.y, imitateMore);
            const vp = gameToViewport(canvasEl, w.x, w.y);
            await debuggerDrawDot(vp.x, vp.y);
            lastDrawnX = p.x;
            lastDrawnY = p.y;
            dotCount++;
          }
          if (imitateDelayMs > 0) await delay(imitateDelayMs);
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
  function runSocketLoop(points, chunkSize, chunkDelayMs, brushSize, logFn, imitateMore, imitateDelayMs) {
    let chunkCount = 0;
    const useImitateDelay = imitateDelayMs > 0;
    const nextTickDelay = useImitateDelay ? imitateDelayMs : chunkDelayMs;

    function tick() {
      if (!drawState.running) return;

      const end = Math.min(drawState.index + (useImitateDelay ? 1 : chunkSize), points.length);
      const cmds = [];
      for (let i = drawState.index; i < end; i++) {
        const p = points[i];
        const w = applyWobble(p.x, p.y, imitateMore);
        const wx = Math.round(w.x), wy = Math.round(w.y);
        cmds.push([0, p.colorId, brushSize, wx, wy, wx, wy]);
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
      drawState.timer = setTimeout(tick, nextTickDelay);
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

  // ── Versioned plan executor (legacy drawing modes above stay separate) ───
  let activePlanRun = null;
  let planRequest = 0;
  function planMessage(message) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(message, response => {
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
          if (!response?.ok) return reject(Object.assign(new Error(response?.error || 'Drawing command failed'), {name:response?.cancelled?'AbortError':'Error'}));
          resolve(response);
        });
      } catch (error) { reject(error); }
    });
  }
  function closePlanSizePicker() {
    const group=document.querySelector('#game-toolbar .sizes'),container=group?.querySelector('.container'),toggle=group?.querySelector('.size-preview');
    if(!container||!toggle)return;
    const r=container.getBoundingClientRect();
    if(container.classList.contains('open')||r.width>0&&r.height>0)toggle.click();
  }
  async function stopPlan() {
    ++planRequest; // Also invalidate a start still awaiting previous cleanup.
    const run = activePlanRun;
    if (!run) return;
    run.cancelled = true;
    if (run.monitor) clearInterval(run.monitor);
    run.unwatch?.();
    if(!run.stopping)run.stopping=planMessage({action:'planCancel',runId:run.id}).finally(()=>{
      if (activePlanRun === run) { closePlanSizePicker();activePlanRun = null; }
    });
    await run.stopping;
  }
  function planPrimaryColor() {
    const primary=document.querySelector('#color-preview-primary'),mobile=document.querySelector('#game-toolbar .color-preview-mobile');
    if(primary)return {element:primary,rgb:parseRgbFromStyle(primary.style.fill||getComputedStyle(primary).fill)};
    if(mobile)return {element:mobile,rgb:parseRgbFromStyle(mobile.style.backgroundColor||getComputedStyle(mobile).backgroundColor)};
    return {element:null,rgb:null};
  }
  async function selectPlanColor(colorId,run,check) {
    check();
    const hex=window.SAGDrawingEngine.PALETTE[colorId];if(!hex)throw new Error('Invalid plan color');
    const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)),same=(actual,expected)=>actual&&actual.r===expected[0]&&actual.g===expected[1]&&actual.b===expected[2];
    let current=planPrimaryColor();
    if(!current.element)throw new Error('Game primary-color preview not found. Cannot verify the drawing color. Reload the game and start again.');
    if(same(current.rgb,rgb))return;
    closePlanSizePicker();check();
    let colors=queryAllRoots('#game-toolbar .colors .color');
    const visible=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0;};
    if(colors.length&&!colors.some(visible)){
      const toggle=document.querySelector('#game-toolbar .color-preview-mobile');
      if(toggle&&visible(toggle)){toggle.click();check();colors=queryAllRoots('#game-toolbar .colors .color');}
    }
    if(!colors.length)colors=findColorElements();
    const target=rgbToLab(...rgb);let best=null,bestD=Infinity,bestRgb=null;
    for(const el of colors){
      if(!el.isConnected)continue;const color=parseRgbFromStyle(el.style.backgroundColor||getComputedStyle(el).backgroundColor);if(!color)continue;
      const value=rgbToLab(color.r,color.g,color.b),distance=labDistSq(value.L,value.a,value.b,target.L,target.a,target.b);
      if(distance<bestD){bestD=distance;best=el;bestRgb=[color.r,color.g,color.b];}
    }
    if(!best||bestD>100)throw new Error('Game color palette not found. Cannot select the planned color '+hex+'.');
    // The game selects primary colors on pointerdown, not click. Address the
    // actual swatch so floating drawers/tooltips cannot intercept it, force
    // primary/left input, and verify its real SVG/mobile color indicator.
    if('PointerEvent' in window){
      const event={bubbles:true,composed:true,cancelable:true,pointerId:1,pointerType:'mouse',isPrimary:true,button:0,altKey:false,ctrlKey:false,shiftKey:false,metaKey:false};
      best.dispatchEvent(new PointerEvent('pointerdown',{...event,buttons:1}));
      best.dispatchEvent(new PointerEvent('pointerup',{...event,buttons:0}));
    }else best.dispatchEvent(new MouseEvent('click',{bubbles:true,button:0,altKey:false}));
    check();current=planPrimaryColor();
    if(!same(current.rgb,bestRgb)){
      // Some integrations require trusted input. Only attempt it when the
      // coordinate really hits this swatch, never a covering panel or canvas.
      const point=elementCenter(best),hit=document.elementFromPoint(point.x,point.y);
      if(visible(best)&&(hit===best||best.contains(hit))){await planMessage({action:'planTool',runId:run.id,points:[point]});check();current=planPrimaryColor();}
    }
    if(!same(current.rgb,bestRgb)){
      const actual=current.rgb?`rgb(${current.rgb.r}, ${current.rgb.g}, ${current.rgb.b})`:'unknown';
      throw new Error('Could not select the game color '+hex+'; primary color is '+actual+'. Drawing stopped before painting with the wrong color. Keep the palette uncovered and start again.');
    }
  }
  async function selectPlanTools(colorId, brushSize, lastBrush, run, check) {
    const visible=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0;};
    const click=async el=>{check();await planMessage({action:'planTool',runId:run.id,points:[elementCenter(el)]});check();};
    check();closePlanSizePicker();await selectPlanColor(colorId,run,check);
    if (brushSize !== lastBrush) {
      const index=brushSize<=4?0:brushSize<=10?1:brushSize<=20?2:brushSize<=32?3:4;
      const sizeGroup=document.querySelector('#game-toolbar .sizes');
      if(sizeGroup) {
        // These controls use click handlers, unlike the pointer-down palette.
        // A coordinate click can hit a floating panel/tooltip instead of opening
        // the first-round picker. Use its own handler and re-query after opening;
        // don't assume hidden or not-yet-created choices are missing forever.
        const choices=()=>[...sizeGroup.querySelectorAll('.size')];
        let sizes=choices();
        if(!sizes[index]||!visible(sizes[index])) {
          const deadline=performance.now()+1000;let opened=false;
          do {
            check();
            const toggle=sizeGroup.querySelector('.size-preview');
            if(!opened&&toggle&&visible(toggle)){toggle.click();opened=true;check();}
            sizes=choices();
            if(sizes[index]&&visible(sizes[index]))break;
            await new Promise(resolve=>setTimeout(resolve,25));check();
          } while(performance.now()<deadline);
        }
        const choice=sizes[index];
        if(!choice||!visible(choice))throw new Error('Game brush-size picker did not become ready. Keep the toolbar visible and start again.');
        check();choice.click();check();
        if(!choice.classList.contains('selected')) {
          // Older integrations may need trusted input. Never cache a brush width
          // unless the native picker actually confirms the requested selection.
          if(visible(choice))await click(choice);
          if(!choice.classList.contains('selected'))throw new Error('Could not select the game brush size. Drawing stopped before sending canvas input.');
        }
      } else {
        const sizes=findBrushSizeElements().filter(visible);
        if(!sizes[index])throw new Error('Game brush controls not found. Cannot reproduce the planned brush width.');
        await click(sizes[index]);
      }
    }
  }
  function overlayCoversCanvas(element,canvas) {
    if(!element||!canvas)return false;
    const r=element.getBoundingClientRect(),c=canvas.getBoundingClientRect();
    if(Math.min(r.right,c.right)-Math.max(r.left,c.left)<=1||Math.min(r.bottom,c.bottom)-Math.max(r.top,c.top)<=1)return false;
    for(let node=element;node;node=node.parentElement){const style=getComputedStyle(node);if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse'||Number(style.opacity)===0)return false;}
    return true;
  }
  function planTurnProblem() {
    const wrapper=document.querySelector('#game-wrapper'),word=document.querySelector('#game-word .word');
    if(!wrapper||wrapper.classList.contains('toolbar-hidden'))return 'Start drawing during your own drawing turn.';
    if(!word||!word.textContent.trim())return 'Drawing word is not ready. Wait for word selection to finish, then start again.';
    const r=word.getBoundingClientRect();
    if(!r.width||!r.height||getComputedStyle(word).visibility==='hidden')return 'Start drawing during your own drawing turn.';
    const canvas=document.querySelector('#game-canvas canvas'),overlay=document.querySelector('#game-canvas .overlay');
    // Skribbl retains the last .reveal.show inside overlay-content after sliding
    // it offscreen. The background overlay's .show class is the live state;
    // measuring that retained reveal's dimensions rejects subsequent turns.
    const covered=overlay?overlay.classList.contains('show')&&overlayCoversCanvas(overlay,canvas):overlayCoversCanvas(document.querySelector('#game-canvas .reveal'),canvas);
    if(covered)return 'The game overlay is still covering the canvas. Wait for it to close, then start again.';
    return '';
  }
  function isPlanDrawingTurn() {
    return !planTurnProblem();
  }
  function planLayout(canvas) {
    const rect=canvas.getBoundingClientRect(),visual=window.visualViewport;
    return {rect,values:[rect.left,rect.top,rect.width,rect.height,window.innerWidth,window.innerHeight,visual?.width||window.innerWidth,visual?.height||window.innerHeight,visual?.offsetLeft||0,visual?.offsetTop||0],scale:visual?.scale||1};
  }
  function samePlanLayout(a,b) {
    return a&&b&&Math.abs(a.scale-b.scale)<0.0001&&a.values.every((value,i)=>Math.abs(value-b.values[i])<0.25);
  }
  async function settledPlanLayout(canvas,check) {
    // Attaching opens Chrome's infobar asynchronously. Always pause before the
    // first press, even if canvas coordinates stay unchanged, so its animation
    // cannot interrupt a held stroke. Then wait for any layout transition too.
    const started=performance.now();let stableSince=started,previous=planLayout(canvas);
    while(performance.now()-started<3000){
      check();await delay(25);check();const next=planLayout(canvas),now=performance.now();
      if(!samePlanLayout(previous,next))stableSince=now;
      previous=next;
      if(now-started>=400&&now-stableSince>=200)return next;
    }
    throw new Error('Game canvas is still moving. Wait for the browser layout to settle, then start drawing again.');
  }
  async function startPlan(plan, options = {}) {
    if(![1,2].includes(plan?.version) || plan.width!==CANVAS_W || plan.height!==CANVAS_H || !Array.isArray(plan.strokes) || !plan.strokes.length)throw new Error('No valid drawing plan. Process an image first.');
    const request=planRequest+1;
    await stopPlan();
    if(request!==planRequest)throw Object.assign(new Error('Drawing stopped before starting.'),{name:'AbortError'});
    stopDrawing();
    const canvas = listAllCanvases().find(info=>info.visible&&info.width===CANVAS_W&&info.height===CANVAS_H&&!info.el.closest('#skribbl-auto-guesser-panel'))?.el;
    if(!canvas)throw new Error('Game canvas not found. Open a room and start your drawing turn.');
    const canDraw=options.canDraw||isPlanDrawingTurn;
    if(!canDraw())throw new Error(planTurnProblem()||'Start drawing during your own drawing turn.');
    const run={id:'plan-'+Date.now()+'-'+Math.random().toString(36).slice(2),cancelled:false,monitor:null,skipped:[],reason:'Drawing stopped.'};
    activePlanRun=run;
    let initialLayout=null;
    const initialWord=document.querySelector('#game-word .word')?.textContent;
    const valid=()=>{const layout=planLayout(canvas);return canvas.isConnected&&layout.rect.width>0&&layout.rect.height>0&&(!initialLayout||samePlanLayout(initialLayout,layout))&&canDraw()&&document.querySelector('#game-word .word')?.textContent===initialWord;};
    const check=()=>{if(activePlanRun!==run||run.cancelled)throw Object.assign(new Error(run.reason),{name:'AbortError'});if(!valid())throw Object.assign(new Error('Drawing turn ended or canvas moved. Reposition and start again.'),{name:'AbortError'});};
    let eventMs=plan.timing?.eventMs||plan.settings.eventMs||8,completed=0,completedMoves=0,brush=-1,port=null;
    const engine=window.SAGDrawingEngine,totalMoves=plan.strokes.reduce((sum,s)=>sum+engine.strokeMoves(s),0);
    try {
      try{await planMessage({action:'planBegin',runId:run.id});}catch(error){if(run.cancelled||error.name==='AbortError')throw Object.assign(error,{name:'AbortError'});throw new Error('Continuous-path drawing requires Chrome debugger access: '+error.message);}
      check();
      try{port=chrome.runtime.connect({name:'planKeepAlive:'+run.id});}catch(_){}
      options.onProgress?.({fraction:0,previewFraction:0,completed:0,stage:'Waiting for the browser layout to settle',skipped:[]});
      initialLayout=await settledPlanLayout(canvas,check);check();
      const initialRect=initialLayout.rect;
      if(initialRect.left<0||initialRect.top<0||initialRect.right>window.innerWidth||initialRect.bottom>window.innerHeight)throw new Error('Keep the complete game canvas visible before starting. Resize or scroll the game into view.');
      const guard=()=>{if(!run.cancelled&&!valid()){run.reason='Drawing turn ended or canvas moved. Drawing stopped before continuing with shifted coordinates.';stopPlan().catch(()=>{});}};
      run.monitor=setInterval(guard,16);
      window.addEventListener('resize',guard);window.addEventListener('scroll',guard,true);
      window.visualViewport?.addEventListener('resize',guard);window.visualViewport?.addEventListener('scroll',guard);
      const observer=new ResizeObserver(guard);observer.observe(canvas);
      run.unwatch=()=>{window.removeEventListener('resize',guard);window.removeEventListener('scroll',guard,true);window.visualViewport?.removeEventListener('resize',guard);window.visualViewport?.removeEventListener('scroll',guard);observer.disconnect();};
      const selectTool=async index=>{
        const tools=[...document.querySelectorAll('#game-toolbar .toolbar-group-tools .tool')],name=index===1?'Fill':'Brush',graphic=index===1?'fill.gif':'pen.gif';
        const control=tools.find(el=>el.dataset.tooltip===name||el.querySelector('.icon')?.style.backgroundImage.includes(graphic))||tools[index];
        if(!control&&plan.strokes.some(s=>s.kind==='region'))throw new Error('Game Brush/Fill tools not found. Select Brush strokes and process again.');
        if(!control)return;
        const r=control.getBoundingClientRect();if(!r.width||!r.height)throw new Error('Keep the game Brush and Fill tools visible before drawing.');
        if(control.classList.contains('selected'))return;
        // The game changes tools on click. Calling the real element's handler
        // avoids a drawer/tooltip intercepting a coordinate click. Verify the
        // actual selected class instead of caching an assumed tool index.
        check();control.click();check();
        if(!control.classList.contains('selected')){await planMessage({action:'planTool',runId:run.id,points:[elementCenter(control)]});check();}
        if(!control.classList.contains('selected'))throw new Error('Could not select the game '+name+' tool. Drawing stopped before sending canvas input.');
      };
      await selectTool(0);
      const started=performance.now();
      const outlineReserve=plan.settings.budget*1000/3;
      const outlineStage=plan.settings.treatment==='light-lines'?'White line strokes':'Black outlines';
      for(const stroke of plan.strokes) {
        check();
        const elapsed=performance.now()-started;
        // A region is atomic: never stop between sealing its boundary and filling
        // it merely because the timing reserve was reached.
        const skipBackground=plan.focus&&stroke.priority==='background'&&elapsed>=plan.settings.budget*1000;
        if(skipBackground||!plan.focus&&stroke.stage==='fill'&&stroke.optional!==false&&elapsed>=plan.settings.budget*1000-outlineReserve){run.skipped.push(stroke.id);completed++;completedMoves+=engine.strokeMoves(stroke);options.onProgress?.({fraction:completed/plan.strokes.length,previewFraction:completedMoves/totalMoves,completed,stage:skipBackground?'Background skipped; subject complete':'Saving time for outlines',skipped:run.skipped.slice()});continue;}
        await selectTool(0);
        await selectPlanTools(stroke.colorId,stroke.brushSize,brush,run,check);
        check();brush=stroke.brushSize;
        for(const part of engine.strokeParts(stroke)) {
          check();await selectTool(part.bucket?1:0);
          // Recheck between contours and their bucket click, and for consecutive
          // same-color strokes. A changed primary color must not poison a fill.
          closePlanSizePicker();await selectPlanColor(stroke.colorId,run,check);
          check();
          const rect=canvas.getBoundingClientRect();
          // Aim at game-pixel centers, including when CSS scales the canvas.
          // Rounding viewport coordinates can move a seed onto its boundary.
          const points=part.points.map(p=>({x:rect.left+(Math.max(0,Math.min(CANVAS_W-1,Math.floor(p.x)))+.5)*rect.width/CANVAS_W,y:rect.top+(Math.max(0,Math.min(CANVAS_H-1,Math.floor(p.y)))+.5)*rect.height/CANVAS_H}))
            .filter((p,i,all)=>!i||p.x!==all[i-1].x||p.y!==all[i-1].y);
          if(!part.bucket&&points.length<2){completedMoves+=Math.max(1,part.points.length-1);continue;}
          const response=await planMessage({action:part.bucket?'planTool':'planStroke',runId:run.id,points});check();
          if(response.events&&!part.bucket)eventMs=Math.max(1,Math.min(100,eventMs*.85+(response.elapsedMs/response.events)*.15));
          completedMoves+=Math.max(1,part.points.length-1);
          options.onProgress?.({fraction:completed/plan.strokes.length,previewFraction:completedMoves/totalMoves,completed,stage:(stroke.priority==='subject'?'Main subject · ':stroke.priority==='background'?'Optional background · ':'')+(stroke.stage==='outline'?outlineStage:part.bucket?'Bucket fills':stroke.kind==='pencil-region'?'Wide pencil strokes':'Sealing color boundaries'),skipped:run.skipped.slice()});
        }
        completed++;
        options.onProgress?.({fraction:completed/plan.strokes.length,previewFraction:completedMoves/totalMoves,completed,stage:(stroke.priority==='subject'?'Main subject · ':stroke.priority==='background'?'Optional background · ':'')+(stroke.stage==='fill'?'Color fills':outlineStage),skipped:run.skipped.slice()});
      }
      return {skipped:run.skipped,elapsedMs:performance.now()-started,eventMs};
    } finally {
      if(run.monitor)clearInterval(run.monitor);
      run.unwatch?.();
      try{port?.disconnect();}catch(_){}
      await planMessage({action:'planCancel',runId:run.id}).catch(()=>{});
      if(activePlanRun===run){closePlanSizePicker();activePlanRun=null;}
      try{await chrome.storage.local.set({sagEventMs:eventMs});}catch(_){}
    }
  }
  async function processPlan(image,options={},context={}) {
    const canvas=window.SAGDrawingEngine.prepareImage(image,options.crop);
    return window.SAGDrawingEngine.processRGBA(canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,CANVAS_W,CANVAS_H),options,context);
  }

  // Keyboard input is still available when the canvas captures the mouse.
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||!activePlanRun&&!drawState.running)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(activePlanRun)stopPlan().catch(()=>{});
    if(drawState.running){stopDrawing();debuggerDetach().catch(()=>{});}
  },true);

  // ── Expose ───────────────────────────────────────────────────────────────

  window.__skribblDrawer = {
    PALETTE, CANVAS_W, CANVAS_H,
    processImage, startDrawing, stopDrawing, estimateTime,
    processPlan, startPlan, stopPlan, isPlanDrawingTurn,
    runCalibration, runCanvasScan,
    listAllCanvases, findGameCanvas,
    checkSocketReady, checkDebuggerReady,
    debuggerAttach, debuggerDetach,
    isDrawing: () => drawState.running,
    getProgress: () => ({ index: drawState.index, total: drawState.points.length }),
  };
})();
