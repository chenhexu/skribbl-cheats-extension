/**
 * Line-art binary image → paths → human-optimized order → G-code / bot JSON.
 * Pen up = move without drawing; pen down = draw.
 */

const GRID_STEP = 8;       // coarser = fewer points, faster; thin edges don't need dense sampling
const MAX_JUMP_SQ = 100;   // max dist^2 to chain two points (~10px)
const MAX_POINTS_PER_PATH = 80;  // subsample long paths so drawing is faster

/**
 * From binary edge image (data[i] === 255 = edge), sample on grid and chain into paths.
 * @returns {Array<Array<{x:number,y:number}>>} paths
 */
function edgeBinaryToPaths(data, w, h) {
  const points = [];
  for (let y = 0; y < h; y += GRID_STEP) {
    for (let x = 0; x < w; x += GRID_STEP) {
      if (data[y * w + x] === 255) points.push({ x, y });
    }
  }
  if (points.length < 2) return [];

  const used = new Uint8Array(points.length);
  const paths = [];

  while (true) {
    let startIdx = -1;
    for (let j = 0; j < points.length; j++) {
      if (!used[j]) { startIdx = j; break; }
    }
    if (startIdx === -1) break;

    const path = [points[startIdx]];
    used[startIdx] = 1;
    let cx = points[startIdx].x, cy = points[startIdx].y;

    for (;;) {
      let best = -1, bestD = Infinity;
      for (let j = 0; j < points.length; j++) {
        if (used[j]) continue;
        const dx = points[j].x - cx, dy = points[j].y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD && d2 <= MAX_JUMP_SQ) { bestD = d2; best = j; }
      }
      if (best === -1) break;
      used[best] = 1;
      path.push(points[best]);
      cx = points[best].x;
      cy = points[best].y;
    }

    if (path.length >= 2) paths.push(simplifyPath(path, MAX_POINTS_PER_PATH));
  }

  return paths;
}

/** Subsample path to at most maxPoints points (keeps start/end) for faster drawing. */
function simplifyPath(path, maxPoints) {
  if (path.length <= maxPoints) return path;
  const out = [];
  const step = (path.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) {
    const idx = i === maxPoints - 1 ? path.length - 1 : Math.round(i * step);
    out.push(path[idx]);
  }
  return out;
}

/**
 * Order paths so the "pen" travels less: greedy nearest-neighbor from current position.
 * Each path can be drawn forward or reversed so we pick the end that is closer.
 * @param {Array<Array<{x:number,y:number}>>} paths
 * @param {{x:number,y:number}} startPos
 * @returns {Array<Array<{x:number,y:number}>>} ordered paths (some may be reversed)
 */
function orderPathsForDrawing(paths, startPos) {
  if (paths.length === 0) return [];
  const pos = startPos ? { x: startPos.x, y: startPos.y } : { x: 0, y: 0 };
  const remaining = paths.map(p => p.slice());
  const ordered = [];

  while (remaining.length > 0) {
    let bestIdx = -1, bestDist = Infinity, reverse = false;

    for (let i = 0; i < remaining.length; i++) {
      const p = remaining[i];
      const start = p[0], end = p[p.length - 1];
      const dStart = (start.x - pos.x) ** 2 + (start.y - pos.y) ** 2;
      const dEnd = (end.x - pos.x) ** 2 + (end.y - pos.y) ** 2;
      if (dStart < bestDist) { bestDist = dStart; bestIdx = i; reverse = true; }
      if (dEnd < bestDist) { bestDist = dEnd; bestIdx = i; reverse = false; }
    }

    const path = remaining[bestIdx];
    remaining.splice(bestIdx, 1);
    ordered.push(reverse ? path.slice().reverse() : path);
    const last = ordered[ordered.length - 1];
    pos.x = last[last.length - 1].x;
    pos.y = last[last.length - 1].y;
  }

  return ordered;
}

/**
 * Convert ordered paths to G-code string.
 * G0 = rapid move (pen up), G1 = linear move (pen down).
 * Coordinates scaled to work area (mm), Y flipped (G-code Y=0 often at bottom).
 * @param {Array<Array<{x:number,y:number}>>} paths
 * @param {number} imgW
 * @param {number} imgH
 * @param {{ workWidthMm: number, workHeightMm: number }}
 */
function pathsToGcode(paths, imgW, imgH, options) {
  const workW = options.workWidthMm != null ? options.workWidthMm : 100;
  const workH = options.workHeightMm != null ? options.workHeightMm : 100;
  const scaleX = imgW > 0 ? workW / imgW : 1;
  const scaleY = imgH > 0 ? workH / imgH : 1;
  const scale = Math.min(scaleX, scaleY);
  const offsetX = (workW - imgW * scale) / 2;
  const offsetY = (workH - imgH * scale) / 2;

  function toMm(px, py) {
    const x = offsetX + px * scale;
    const y = workH - (offsetY + py * scale);
    return { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 };
  }

  const lines = ['; Line-art G-code (pen up = G0, pen down = G1)', 'G21', 'G90'];

  for (const path of paths) {
    if (path.length === 0) continue;
    const start = toMm(path[0].x, path[0].y);
    lines.push(`G0 X${start.x} Y${start.y}`);
    for (let i = 1; i < path.length; i++) {
      const p = toMm(path[i].x, path[i].y);
      lines.push(`G1 X${p.x} Y${p.y}`);
    }
  }

  lines.push('G0 X0 Y0');
  return lines.join('\n');
}

/**
 * Convert ordered paths to a bot-friendly JSON: where to move, when to draw, when to release.
 * Coordinates normalized 0..1 (origin top-left). Bot can scale to canvas.
 * @param {Array<Array<{x:number,y:number}>>} paths
 * @param {number} imgW
 * @param {number} imgH
 */
function pathsToBotJson(paths, imgW, imgH) {
  const scaleX = imgW > 0 ? 1 / imgW : 1;
  const scaleY = imgH > 0 ? 1 / imgH : 1;

  const strokes = [];
  for (const path of paths) {
    if (path.length === 0) continue;
    strokes.push({ penDown: false, points: [[path[0].x * scaleX, path[0].y * scaleY]] });
    const drawPoints = path.map(p => [p.x * scaleX, p.y * scaleY]);
    strokes.push({ penDown: true, points: drawPoints });
  }

  return {
    version: 1,
    width: imgW,
    height: imgH,
    strokes,
    description: 'Ordered strokes: penDown false = move only, penDown true = draw. Points in 0..1.'
  };
}
