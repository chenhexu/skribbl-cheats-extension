# In-Chrome AI and setup — 2.3.3

## User flow

Local AI setup opens a dedicated engine page. Choose Chrome GPU, Chrome CPU, or the existing Python terminal service. The saved choice is shared by word suggestions, subject detection and AI line detection in the game panel and large viewer. Existing installations retain Python until the user chooses another engine. The setup page explains the game panel versus the image-only viewer, shows per-model readiness, provides a warm word-search speed test and unloads browser models on request. Opening setup from an uploaded image retains a session link back to that image.

Chrome engines need no terminal, localhost grant, API key, runtime model download or hosted inference service. Python remains a separate companion installation at the fixed optional endpoint. Its setup command/instructions appear only for that engine. Python may also use CUDA; terminal versus browser describes the host, not an absolute GPU/CPU distinction.

## Implementation

- ONNX Runtime Web 1.22.0 and the Transformers.js 3.8.1 tokenizer are bundled as local JavaScript/WASM. Remote model loading is disabled. CPU uses single-threaded SIMD WASM without cross-origin isolation; GPU uses WebGPU. Backend choice is explicit, without silently switching to the Python service or requesting its permission.
- The background creates one packaged offscreen document with the WORKERS reason after optional Offscreen access is granted from AI setup. It hosts a dedicated worker so inference does not run on the game's UI thread. Creation is coalesced; changing engines aborts outstanding requests, closes the old document and persists the choice. Requests wait for a configuration change to finish. Cancellation discards late results and yields between custom-word batches.
- During a bounded AI request, the background calls a lightweight extension API every 20 seconds to prevent idle suspension while it awaits inference. Timers stop on completion, failure or cancellation; this follows Chrome's guidance for [long-running service-worker work](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers#keep_a_service_worker_alive). Closed offscreen message channels retry once; fatal worker errors drain pending replies and allow the next attempt to create a new worker.
- Word-search content messaging also retries a lost background response channel once, with a new request ID and cancellation of the abandoned request. Abort settles immediately, late results remain ignored, and unanswered channels have a 35-second client deadline per attempt. Genuine configuration/model failures are not retried or silently redirected to another backend.
- MiniLM uses the same pinned model revision as Python, 64-token truncation, masked mean pooling and normalized cosine similarity. The 3,708 public dictionary vectors are exported from the existing public-only cache. Queries/custom vectors stay in bounded memory caches. Every returned word still comes from the submitted hint-eligible bank.
- U2NETP uses 320px ImageNet normalization and the source alpha mask. Line AI uses a 256px white-padded aspect-preserving transform and reverses that transform on output. Pixel resizing differs slightly between Canvas and Pillow. Browser CPU/GPU outputs were compared with Python outputs on a representative fixture.
- At fixed 320px input, all subject-model MaxPool inputs have even spatial dimensions. Export verifies this before replacing unsupported WebGPU ceil-mode pooling with the mathematically identical floor mode. Trained weights are unchanged. Models are loaded and run once before setup reports Ready, catching unsupported operators during warm-up.
- Offscreen/model runtime assets are extension-internal. Only page-hook.js remains web accessible. Setup-only messages control engine configuration/unloading; game content can request inference, not change the engine. The only optional network inference permission remains the fixed Python port. Packaged WASM uses the MV3 wasm-unsafe-eval CSP permission, without unsafe-eval or remote scripts.

## Verification

`npm test` covers broker defaults/validation, single-document creation under concurrent requests, cancellation before/after creation, late-result rejection, bounded connection retries, crashed-worker recreation, pending-work keep-alive cleanup and existing guess/drawing behavior.

`npm run test:browser-ai` uses isolated real Chromium extension profiles with a synthetic Skribbl page. It verifies learned music → guitar suggestions through the actual content script, strict hint-length filtering, real subject/line model calls from the viewer, setup/image session transfer, worker closure on switching to Python, persistence after a full browser restart, and zero external inference/network requests in the controlled fixture. It also closes the actual offscreen document during a cold search and stops the background service worker during another pending search; both current queries must finish automatically without retyping. It seeds the bundled dictionary so the unrelated legacy public-list download behavior is excluded.

`node tools/smoke-browser-ai.cjs` and `node tools/smoke-browser-ai.cjs --gpu` exercise both engines with real model inference and save reports/screenshots under screenshots/browser-ai. On the test computer, warmed word searches took roughly 15–20 ms including extension messaging. A warmed GPU image test took about 0.2 seconds per model versus around 2 seconds for browser CPU. Cold model loading/compilation takes several seconds. These measurements are fixture/device-specific, not universal promises.

Pixel comparisons with Python on the fixture gave mean absolute grayscale errors of about 0.12/255 for subject masks and 1.35/255 for line art, reflecting Canvas/Pillow resizing differences. The check is a conversion/alignment regression, not proof of perfect foreground detection on every image.

Tests use isolated profiles and temporary services on port 8766 where needed. The user's Chrome tabs and service on port 8765 are untouched. No store publication is performed.

## Rebuilding

The browser binaries/models are already materialized in the release ZIP. End users load the extension and choose an engine; they do not need npm or Python. Source checkouts exclude generated binaries; restore the matching release models with `tools/restore-browser-models.ps1` as described in [Development](DEVELOPMENT.md).

For developers, install npm dependencies with `npm ci`. `npm run build:ai` rebuilds the worker and copies the packaged WASM/licenses. The Transformers.js Node-only sharp dependency is overridden to patched 0.35.5 and excluded from the browser bundle; the dependency audit is clean.

To regenerate models, first install the three Python checkpoints and public embedding cache as described in the source README. Install `onnx==1.19.1` in that project's Python environment, then run `ai-service/.venv/Scripts/python.exe tools/export-browser-models.py`. It uses local checkpoints only, checks ONNX graphs, exports only public vectors, retains licenses and records hashes. `npm run package` rebuilds the runtime, verifies model hashes, validates the explicit file allowlist and creates the ZIP plus SHA256 metadata. Python source/dependencies and test profiles are excluded from the ZIP.

Primary implementation references: [Chrome offscreen API](https://developer.chrome.com/docs/extensions/reference/api/offscreen), [ONNX Runtime Web deployment](https://onnxruntime.ai/docs/tutorials/web/deploy.html), [Transformers.js browser extensions](https://huggingface.co/docs/transformers.js/en/tutorials/browser-extension).
