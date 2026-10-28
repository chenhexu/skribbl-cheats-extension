/**
 * Canny-style pipeline: grayscale → Gaussian → Sobel → non-max → double threshold → hysteresis.
 * Each step returns { data, width, height, channels } (channels 1 for gray, 4 for RGBA).
 */

function getImageData(img) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, c.width, c.height);
}

// Contrast stretch: map luminance range [min, max] to [0, 255], preserve hue.
function contrastStretch(imgData) {
  const { data, width, height } = imgData;
  const n = width * height;
  let lMin = 255, lMax = 0;
  for (let i = 0; i < n; i++) {
    const j = i * 4;
    const L = (0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2]) | 0;
    if (L < lMin) lMin = L;
    if (L > lMax) lMax = L;
  }
  const range = lMax - lMin || 1;
  const out = new Uint8Array(data.length);
  for (let i = 0; i < n; i++) {
    const j = i * 4;
    const L = (0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2]) | 0;
    const newL = (255 * (L - lMin) / range) | 0;
    const scale = L > 0 ? newL / L : 0;
    out[j] = Math.min(255, (data[j] * scale) | 0);
    out[j + 1] = Math.min(255, (data[j + 1] * scale) | 0);
    out[j + 2] = Math.min(255, (data[j + 2] * scale) | 0);
    out[j + 3] = data[j + 3];
  }
  return { data: out, width, height, channels: 4 };
}

// Fade edges toward border color so Canny sees less background noise (subject often in center).
// strength 0 = no change, 1 = full fade at edges.
function suppressBackground(imgData, strength) {
  if (!strength || strength <= 0) return { data: new Uint8Array(imgData.data), width: imgData.width, height: imgData.height, channels: 4 };
  const { data, width, height } = imgData;
  const w = width, h = height;
  const n = w * h;
  const cx = w / 2, cy = h / 2;
  const maxR = Math.sqrt(cx * cx + cy * cy);

  let br = 0, bg = 0, bb = 0, count = 0;
  const border = Math.max(2, Math.floor(0.08 * Math.min(w, h)));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x >= border && x < w - border && y >= border && y < h - border) continue;
      const j = (y * w + x) * 4;
      br += data[j]; bg += data[j + 1]; bb += data[j + 2];
      count++;
    }
  }
  if (count === 0) count = 1;
  const bR = (br / count) | 0, bG = (bg / count) | 0, bB = (bb / count) | 0;

  const inner = 0.25 * maxR;
  const outer = 0.85 * maxR;
  const out = new Uint8Array(data.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const j = (y * w + x) * 4;
      const dx = x - cx, dy = y - cy;
      const r = Math.sqrt(dx * dx + dy * dy);
      let t = r <= inner ? 1 : r >= outer ? 0 : 1 - (r - inner) / (outer - inner);
      t = t * strength + (1 - strength);
      out[j] = (data[j] * t + bR * (1 - t)) | 0;
      out[j + 1] = (data[j + 1] * t + bG * (1 - t)) | 0;
      out[j + 2] = (data[j + 2] * t + bB * (1 - t)) | 0;
      out[j + 3] = data[j + 3];
    }
  }
  return { data: out, width: w, height: h, channels: 4 };
}

function grayscale(imgData) {
  const { data, width, height } = imgData;
  const out = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const j = i * 4;
    out[i] = (0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2]) | 0;
  }
  return { data: out, width, height, channels: 1 };
}

// 5×5 Gaussian kernel (sigma ≈ 1.4). Kernel from Wikipedia Canny article.
const GAUSS_5 = [2, 4, 5, 4, 2, 4, 9, 12, 9, 4, 5, 12, 15, 12, 5, 4, 9, 12, 9, 4, 2, 4, 5, 4, 2];
const GAUSS_5_SUM = 159;

function gaussianBlur(inp, sigma) {
  const { data, width, height } = inp;
  let current = new Uint8Array(data);
  let next = new Uint8Array(width * height);
  const w = width, h = height;
  // More sigma = more smoothing: run multiple 5×5 passes (1 pass ≈ sigma 1.4)
  const passes = sigma > 0 ? Math.max(1, Math.round(sigma)) : 1;
  for (let pass = 0; pass < passes; pass++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0, weight = 0;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const nx = Math.max(0, Math.min(w - 1, x + dx));
            const ny = Math.max(0, Math.min(h - 1, y + dy));
            const k = (dy + 2) * 5 + (dx + 2);
            sum += current[ny * w + nx] * GAUSS_5[k];
            weight += GAUSS_5[k];
          }
        }
        next[y * w + x] = (sum / weight) | 0;
      }
    }
    const swap = current; current = next; next = swap;
  }
  return { data: current, width: w, height: h, channels: 1 };
}

// Sobel 3×3: Gx, Gy. Returns { mag, dir, width, height }; dir in radians.
const SOBEL_X = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
const SOBEL_Y = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

function sobel(inp) {
  const { data, width, height } = inp;
  const w = width, h = height;
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
  return { mag, dir, width: w, height: h };
}

// Sample magnitude at (xf, yf) with bilinear interpolation. Clamp to valid range.
function sampleMag(mag, w, h, xf, yf) {
  const x = Math.max(0, Math.min(w - 1, xf));
  const y = Math.max(0, Math.min(h - 1, yf));
  const x0 = Math.min(Math.floor(x), w - 2);
  const y0 = Math.min(Math.floor(y), h - 2);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const dx = x - x0, dy = y - y0;
  const m00 = mag[y0 * w + x0], m10 = mag[y0 * w + x1], m01 = mag[y1 * w + x0], m11 = mag[y1 * w + x1];
  return (1 - dx) * (1 - dy) * m00 + dx * (1 - dy) * m10 + (1 - dx) * dy * m01 + dx * dy * m11;
}

// Non-maximum suppression with linear interpolation along gradient direction
// (per Canny: compare to interpolated neighbors so we don't over-suppress → fewer gaps).
function nonMaxSuppression(sobelOut) {
  const { mag, dir, width, height } = sobelOut;
  const w = width, h = height;
  const out = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const m = mag[i];
      const theta = dir[i];
      const cosT = Math.cos(theta), sinT = Math.sin(theta);
      const n1 = sampleMag(mag, w, h, x + cosT, y + sinT);
      const n2 = sampleMag(mag, w, h, x - cosT, y - sinT);
      out[i] = (m >= n1 && m >= n2 && m > 0) ? Math.min(255, m) : 0;
    }
  }
  return { data: out, width: w, height: h, channels: 1 };
}

// Normalize to 0–255 so UI thresholds have consistent effect across images.
function normalizeTo255(inp) {
  const { data, width, height } = inp;
  const w = width, h = height;
  let max = 0;
  for (let i = 0; i < w * h; i++) if (data[i] > max) max = data[i];
  if (max === 0) return { data: new Uint8Array(data), width: w, height: h, channels: 1 };
  const scale = 255 / max;
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = Math.min(255, (data[i] * scale) | 0);
  return { data: out, width: w, height: h, channels: 1 };
}

// Double threshold: strong (255), weak (64), rest 0.
function doubleThreshold(inp, low, high) {
  const { data, width, height } = inp;
  const w = width, h = height;
  const out = new Uint8Array(w * h);
  const STRONG = 255, WEAK = 64;
  for (let i = 0; i < w * h; i++) {
    const v = data[i];
    out[i] = v >= high ? STRONG : v >= low ? WEAK : 0;
  }
  return { data: out, width: w, height: h, channels: 1, strong: STRONG, weak: WEAK };
}

// Hysteresis: from each strong pixel, recursively trace and mark connected weak pixels
// (per Song Ho / standard Canny: "trace all 8 directions until magnitude < low" → continuous lines).
const HYST_DX = [-1, 0, 1, -1, 1, -1, 0, 1];
const HYST_DY = [-1, -1, -1, 0, 0, 1, 1, 1];

function hysteresis(inp) {
  const { data, width, height } = inp;
  const w = width, h = height;
  const out = new Uint8Array(data);
  const STRONG = 255, WEAK = 64;
  const stack = [];
  for (let i = 0; i < w * h; i++) if (out[i] === STRONG) stack.push(i);
  while (stack.length) {
    const i = stack.pop();
    const x = i % w, y = (i / w) | 0;
    for (let k = 0; k < 8; k++) {
      const nx = x + HYST_DX[k], ny = y + HYST_DY[k];
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      const ni = ny * w + nx;
      if (out[ni] === WEAK) {
        out[ni] = STRONG;
        stack.push(ni);
      }
    }
  }
  for (let i = 0; i < w * h; i++) if (out[i] === WEAK) out[i] = 0;
  return { data: out, width: w, height: h, channels: 1 };
}

// For display: normalize float magnitude to 0–255 (step 5 Sobel).
function sobelToUint8(sobelOut) {
  const { mag, width, height } = sobelOut;
  const w = width, h = height;
  let max = 0;
  for (let i = 0; i < w * h; i++) if (mag[i] > max) max = mag[i];
  const scale = max > 0 ? 255 / max : 1;
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = Math.min(255, (mag[i] * scale) | 0);
  return { data: out, width: w, height: h, channels: 1 };
}

// Simple threshold on Sobel magnitude (0–255) → binary. Good for "thick lines" final output.
function sobelThreshold(sobelUint8, thresh) {
  const { data, width, height } = sobelUint8;
  const w = width, h = height;
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = data[i] >= thresh ? 255 : 0;
  return { data: out, width: w, height: h, channels: 1 };
}

// 3×3 dilation: merge nearby edge pixels so dots become short lines.
function dilateEdges(inp) {
  const { data, width, height } = inp;
  const w = width, h = height;
  const out = new Uint8Array(data);
  const dx = [-1, 0, 1, -1, 1, -1, 0, 1];
  const dy = [-1, -1, -1, 0, 0, 1, 1, 1];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (data[i] === 255) continue;
      for (let k = 0; k < 8; k++) {
        if (data[(y + dy[k]) * w + (x + dx[k])] === 255) {
          out[i] = 255;
          break;
        }
      }
    }
  }
  return { data: out, width: w, height: h, channels: 1 };
}

function runPipeline(img, options) {
  const { sigma = 1.4, low = 20, high = 55, finalMode = 'canny', sobelThresh = 40, dilate = false, bgSuppress = false } = options || {};
  const imgData = getImageData(img);
  const w = imgData.width, h = imgData.height;

  const step1 = { data: new Uint8Array(imgData.data), width: w, height: h, channels: 4 };
  const step2 = contrastStretch(step1);
  const step3 = suppressBackground(step2, bgSuppress ? 0.75 : 0);
  const step4 = grayscale(step3);
  const step5 = gaussianBlur(step4, sigma);
  const sobelOut = sobel(step5);
  const step6 = sobelToUint8(sobelOut);
  const step7 = nonMaxSuppression(sobelOut);
  const step7norm = normalizeTo255(step7);
  const step8 = doubleThreshold(step7norm, low, high);
  const step9Thin = finalMode === 'sobel'
    ? sobelThreshold(step6, sobelThresh)
    : hysteresis(step8);
  let step9 = step9Thin;
  if (dilate) {
    step9 = dilateEdges(step9);
    step9 = dilateEdges(step9); // 2 passes: connect more dots (display only)
  }
  const steps = [step1, step2, step3, step4, step5, step6, step7, step8, step9];
  const step1Data = step1.data;
  let hasTransparency = false;
  for (let i = 3; i < step1Data.length; i += 4) {
    if (step1Data[i] < 128) { hasTransparency = true; break; }
  }
  if (hasTransparency) {
    const w = step1.width, h = step1.height;
    const alphaMask = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) alphaMask[i] = step1Data[i * 4 + 3] >= 128 ? 255 : 0;
    steps.push({ data: alphaMask, width: w, height: h, channels: 1 });
  }
  if (dilate) steps.push(step9Thin);
  return steps;
}
