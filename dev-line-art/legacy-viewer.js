const fileInput = document.getElementById('file');
    const dropZone = document.getElementById('dropZone');
    const filenameEl = document.getElementById('filename');
    const stepsEl = document.getElementById('steps');
    let currentFile = null;
    let lastResults = null;
    const steps = [
      { id: 'original', title: '1. Original' },
      { id: 'contrast', title: '2. Contrast stretch' },
      { id: 'bgsuppress', title: '3. Background suppress' },
      { id: 'grayscale', title: '4. Grayscale' },
      { id: 'gaussian', title: '5. Gaussian blur' },
      { id: 'sobel', title: '6. Sobel (gradient magnitude)' },
      { id: 'nonmax', title: '7. Non-maximum suppression' },
      { id: 'threshold', title: '8. Double threshold' },
      { id: 'hysteresis', title: '9. Final edges' }
    ];
    steps.forEach(s => {
      const div = document.createElement('div');
      div.className = 'step' + (s.id === 'hysteresis' ? ' step-final' : '');
      div.innerHTML = '<h2>' + s.title + '</h2><canvas id="' + s.id + '"></canvas><p></p>';
      stepsEl.appendChild(div);
    });

    function renderResults(results) {
      const alphaMask = results.length > 9 && results[9].channels === 1 ? results[9] : null;
      results.forEach((data, i) => {
        if (i >= steps.length) return;
        let drawData = data;
        if (i === steps.length - 1 && alphaMask && data && data.channels === 1) {
          const w = data.width, h = data.height;
          const rgba = new Uint8Array(w * h * 4);
          for (let j = 0; j < w * h; j++) {
            const v = data.data[j];
            rgba[j * 4] = rgba[j * 4 + 1] = rgba[j * 4 + 2] = v;
            rgba[j * 4 + 3] = alphaMask.data[j];
          }
          drawData = { data: rgba, width: w, height: h, channels: 4 };
        }
        const isFinal = i === steps.length - 1;
        const maxW = isFinal ? 720 : 400;
        const maxH = isFinal ? 480 : 300;
        const canvas = document.getElementById(steps[i].id);
        const p = canvas.nextElementSibling;
        if (!drawData) { canvas.width = 0; canvas.height = 0; p.textContent = '—'; return; }
        const w = drawData.width, h = drawData.height;
        const scale = Math.min(maxW / w, maxH / h, 1);
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(canvas.width, canvas.height);
        const out = imgData.data;
        const stepX = w / canvas.width, stepY = h / canvas.height;
        for (let dy = 0; dy < canvas.height; dy++) {
          for (let dx = 0; dx < canvas.width; dx++) {
            const sx = Math.min(Math.floor(dx * stepX), w - 1);
            const sy = Math.min(Math.floor(dy * stepY), h - 1);
            const o = (dy * canvas.width + dx) * 4;
            if (drawData.channels === 1) {
              const j = sy * w + sx;
              const v = drawData.data[j];
              out[o] = out[o + 1] = out[o + 2] = v;
              out[o + 3] = 255;
            } else {
              const j = (sy * w + sx) * 4;
              out[o] = drawData.data[j];
              out[o + 1] = drawData.data[j + 1];
              out[o + 2] = drawData.data[j + 2];
              out[o + 3] = drawData.data[j + 3] !== undefined ? drawData.data[j + 3] : 255;
            }
          }
        }
        ctx.putImageData(imgData, 0, 0);
        p.textContent = w + '×' + h + (drawData.channels === 1 ? ' (grayscale)' : '') + (i === steps.length - 1 && alphaMask ? ' (transparent bg)' : '');
      });
    }

    function setCurrentFile(file) {
      currentFile = file || null;
      filenameEl.textContent = file ? file.name : '';
    }

    async function runAndRender() {
      const file = currentFile || fileInput.files[0];
      if (!file) { alert('Upload an image first.'); return; }
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
      const sigma = parseFloat(document.getElementById('sigma').value) || 1.4;
      const low = parseInt(document.getElementById('low').value, 10) || 20;
      const high = parseInt(document.getElementById('high').value, 10) || 55;
      const finalMode = document.getElementById('finalMode').value;
      const sobelThresh = parseInt(document.getElementById('sobelThresh').value, 10) || 40;
      const dilate = document.getElementById('dilate').checked;
      const bgSuppress = document.getElementById('bgSuppress').checked;
      const results = runPipeline(img, { sigma, low, high, finalMode, sobelThresh, dilate, bgSuppress });
      lastResults = results;
      renderResults(results);
      URL.revokeObjectURL(img.src);
    }

    function getExportBinary() {
      if (!lastResults || lastResults.length < 9) return null;
      return lastResults.length > 9 ? lastResults[9] : lastResults[8];
    }

    function exportPaths() {
      const bin = getExportBinary();
      if (!bin || bin.channels !== 1) { alert('Run the pipeline first (upload an image and click Re-run).'); return null; }
      const paths = edgeBinaryToPaths(bin.data, bin.width, bin.height);
      return orderPathsForDrawing(paths, { x: 0, y: 0 });
    }

    document.getElementById('downloadGcode').addEventListener('click', () => {
      const ordered = exportPaths();
      if (!ordered) return;
      const bin = getExportBinary();
      const workW = parseFloat(document.getElementById('workWidth').value) || 100;
      const workH = parseFloat(document.getElementById('workHeight').value) || 100;
      const gcode = pathsToGcode(ordered, bin.width, bin.height, { workWidthMm: workW, workHeightMm: workH });
      const blob = new Blob([gcode], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'line-art.gcode';
      a.click();
      URL.revokeObjectURL(a.href);
    });

    document.getElementById('downloadBotJson').addEventListener('click', () => {
      const ordered = exportPaths();
      if (!ordered) return;
      const bin = getExportBinary();
      const json = pathsToBotJson(ordered, bin.width, bin.height);
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'line-art-bot.json';
      a.click();
      URL.revokeObjectURL(a.href);
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) { setCurrentFile(file); runAndRender(); }
    });

    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); e.stopPropagation(); dropZone.classList.remove('drag-over'); });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (!file || !file.type.startsWith('image/')) { alert('Please drop an image file.'); return; }
      setCurrentFile(file);
      runAndRender();
    });

    document.getElementById('refresh').addEventListener('click', runAndRender);
    document.getElementById('finalMode').addEventListener('change', (e) => {
      document.getElementById('sobelThreshWrap').style.display = e.target.value === 'sobel' ? 'inline' : 'none';
    });
