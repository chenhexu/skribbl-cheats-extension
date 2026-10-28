# Line-art pipeline – local dev viewer

Temporary local site to **see each filter step** (Canny-style) on an image.

## How to run

1. **Option A – open file directly**
   Open `index.html` in your browser (double-click or drag into Chrome/Edge/Firefox).
   If the file input does not work (some browsers block file://), use Option B.

2. **Option B – simple HTTP server**
   From this folder (or the extension root), run:
   ```bash
   npx serve dev-line-art
   ```
   or
   ```bash
   python -m http.server 8080
   ```
   then open `http://localhost:8080/dev-line-art/` (or `http://localhost:8080/` if you started inside `dev-line-art`).

## What you see

1. **Original** – loaded image
2. **Grayscale** – luminance
3. **Gaussian blur** – 5×5 kernel (reduces noise)
4. **Sobel** – gradient magnitude (edges)
5. **Non-maximum suppression** – thin edges (single-pixel)
6. **Double threshold** – strong (white) / weak (gray) / rest (black)
7. **Hysteresis** – final edges (weak kept only if connected to strong)

You can change **Gaussian sigma**, **Low threshold**, and **High threshold** in the form before or after loading an image; re-upload the same image to re-run with new params.

## Files

- `index.html` – UI and step canvases
- `pipeline.js` – pipeline steps (grayscale, Gaussian, Sobel, non-max, threshold, hysteresis)

This folder is for local dev only and is not part of the extension build.
