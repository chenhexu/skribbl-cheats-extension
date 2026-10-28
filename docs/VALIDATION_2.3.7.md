# Version 2.3.7 validation

Checked October 28, 2026 on Windows using isolated Chrome profiles and synthetic game markup. No guesses or drawings were sent to a live room.

- `npm test`: all 94 Node checks passed, including transport cancellation, word-bank filtering, palette planning, browser AI messaging and duplicate-manifest rejection.
- Playwright: 27 passed and one skipped across `drawing-turn.spec.cjs`, `executor.spec.cjs`, `panel-layout.spec.cjs` and `studio.spec.cjs`. The checks used an ephemeral loopback static server for browser processing; the test requiring a running Python model service was skipped.
- Drawing startup: trusted CDP input waits before the first press when canvas coordinates stay unchanged, and waits through a simulated delayed viewport resize and animated layout. A later shift releases held input and prevents a bucket click on an unfinished boundary. The native Chrome infobar itself was not automated.
- Outline detail: adjusting the slider preserves Auto mode and other suggestions, including during an in-flight suggestion. Compact and large viewers retain the independent values.
- Executor and layout: trusted strokes, region fills, brush initialization, Stop/restart, turn loss, all eight resize directions and viewport edges passed.
- Reorganized fixtures: both the supplied line drawing and photograph process from `tests/fixtures/`; the compact processing/cancellation check also uses the relocated photo.
- Screenshots: all eight source captures match their recorded SHA256 and retained local originals. Five selected crops and three alternatives use 1280 × 800 or 640 × 400 RGB PNGs. Crop records and a rebuild script are included.
- Documentation: local Markdown links and README image targets resolve after moving branding, archived code, old screenshots and listing text.
- Package: the 49 installable file bytes match the ZIP submitted for store review. Runtime entry points, manifest permissions and model assets were not changed by repository cleanup. The submitted ZIP and its original metadata remain under ignored `dist/submitted/2.3.7/`.

The GitHub package is rebuilt from the committed source with a clean source revision in its adjacent metadata. Packaging verifies model hashes, JavaScript syntax, manifest references, and exactly one root `manifest.json`. Source artwork, screenshots, archives, tests and the Python service remain outside the installable ZIP.

Prior loaded-extension CPU/GPU and permission evidence remains in [Browser AI](BROWSER_AI.md) and the [2.3.3 permission audit](STORE_PERMISSIONS_AUDIT.md). Those historical reports are not relabeled as new model benchmarks.
