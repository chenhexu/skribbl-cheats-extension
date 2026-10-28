/**
 * Original Imitate pipeline – archived from drawer.js
 * Used when style === 'imitate'. Depends on: nearestColorId(r, g, b, skipWhite) from drawer (PALETTE/LAB).
 */

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

    const points = [];
    return { points, curveSegments: outlineCurveSegments };
  }
