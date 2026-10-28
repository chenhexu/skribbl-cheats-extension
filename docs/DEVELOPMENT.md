# Development and release builds

Use the prebuilt extension ZIP for normal installation. A source checkout contains the application, model metadata/tokenizers/licenses, companion Python service and tests. Large ONNX/vector binaries and generated browser runtime are excluded from Git history.

## Restore a source checkout

Use Node.js 20+ and Windows PowerShell. Clone the repository, then run:

```powershell
npm ci
```

Download `skribbl-auto-guesser-2.3.3.zip` from [the matching GitHub release](https://github.com/chenhexu/skribbl-cheats-extension/releases/tag/v2.3.3). Restore models from that ZIP:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\restore-browser-models.ps1 -Archive "C:\path\to\skribbl-auto-guesser-2.3.3.zip"
npm run build:ai
```

The restore tool checks every model asset's size and SHA256 against the checked-in manifest before extracting the expected files. It does not execute files from the archive. `build:ai` builds the worker and copies the npm-pinned runtime/WASM and licenses. You can now load this project folder unpacked in Chrome.

The ZIP includes the model assets end users need; a GitHub source-code archive alone does not. Download the release's SHA256 metadata alongside it to verify the whole package if desired.

## Tests

```powershell
npm test
npm run test:ui
npm run test:browser-ai
```

UI tests use Playwright and an isolated local viewer on port 8766; see `playwright.config.cjs` for the configured browser. Real extension tests require a compatible installed Chromium. `SAG_TEST_CHROMIUM` can specify its executable; `SAG_AI_EXTENSION` can point at an extracted release ZIP. The integration test uses synthetic game markup and isolated profiles; it does not send guesses into a live room.

```powershell
node tools/smoke-browser-ai.cjs
node tools/smoke-browser-ai.cjs --gpu
node tools/verify-permissions.cjs "C:\path\to\extracted-extension"
```

The Python service tests use Python's unittest runner from `ai-service/`; install its requirements in a virtual environment first. Never use a user's active browser profile or stop an unrelated local service for testing. Test reports/screenshots include fixture-specific evidence and are not universal performance promises.

## Regenerate models from checkpoints

Install the Python dependencies/checkpoints using [the terminal setup guide](USAGE.md#optional-python-terminal-service), then wait for its public word-embedding cache to finish building. Stop that service with Ctrl+C when finished. Install `onnx==1.19.1` in its virtual environment, then run:

```powershell
.\ai-service\.venv\Scripts\python.exe .\tools\export-browser-models.py
npm run build:ai
```

The exporter reads local checkpoints, verifies ONNX graphs and records hashes, tokenizer files, licenses and public embeddings in `browser-ai/models/manifest.json`. It exports no query/custom-word cache. Updating a model requires reviewing its license, committing the new manifest/configuration, testing real CPU/GPU inference and distributing the corresponding binaries in a release ZIP.

## Package

```powershell
npm run package
```

This rebuilds browser AI, checks model hashes, validates manifest references and JavaScript syntax, and writes `dist/skribbl-auto-guesser-2.3.3.zip` plus `.zip.json` metadata containing its SHA256, source commit and file list. The modified flag covers tracked source files; unrelated untracked local files are excluded. The explicit allowlist excludes tests, screenshots, Python, npm dependencies and submission documents. Model/runtime licenses and privacy/third-party notices are retained. Commit the intended source changes before the final package build so its metadata identifies a clean source revision.

[Store submission checklist](../store/README.md) · [Permission evidence](STORE_PERMISSIONS_AUDIT.md) · [Browser AI architecture and verification](BROWSER_AI.md)
