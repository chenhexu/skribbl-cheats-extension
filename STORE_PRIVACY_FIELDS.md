# Chrome Web Store submission fields — 2.3.3

Updated October 28, 2026. These descriptions match the current standalone extension. Replace the older submission text; the rejected 2.1.0 draft does not update itself when local files change.

## Rejection addressed: Purple Potassium / unused storage

The screenshot rejects **2.1.0** for requesting `storage` without using it. The current **2.3.3** package uses `chrome.storage.local` for the AI engine choice, five shared Auto-Drawer preferences and measured drawing-event latency. Legacy guesser settings/word caches separately use the site's `localStorage`.

Real extracted-ZIP tests verified preference writes, sharing across viewers, and persistence after a full browser restart. Removing `storage` from an isolated test copy made the same save/restore features fail. Keep the permission for these implemented features; do not upload the old rejected ZIP. See [audit evidence](docs/STORE_PERMISSIONS_AUDIT.md).

## Single-purpose description

```text
Assist Skribbl play with hint-matching word suggestions and user-controlled guessing, plus optional tools that turn uploaded images into previews and drawing plans for the game canvas.
```

## Storage justification

```text
chrome.storage.local saves the AI engine choice (Chrome GPU, Chrome CPU or Python service), five Auto-Drawer preferences (drawing speed, target time, subject/background mode, line detector and color amplification), and measured drawing-event latency. Choices persist across browser restarts and are shared between the game panel and extension-owned viewers. Data stays on the device. Legacy guesser settings and word caches separately use the site's localStorage.
```

## Optional Offscreen justification

```text
Offscreen is an optional permission requested when the user chooses a Chrome AI engine or clicks Load AI models in AI setup. The engine creates the packaged browser-ai/offscreen.html document with the WORKERS reason. It hosts a dedicated worker running packaged ONNX models for word suggestions, foreground masks and line detection. This keeps inference off the game UI thread and available across tabs without a permanent visible tab. The document is closed when changing engines or unloading models. Python mode and ordinary guessing do not need this grant. Real extension tests verify the default ungranted state, permission grant on engine choice, creation, inference, closure and backend persistence.
```

The extension-page CSP enables wasm-unsafe-eval for packaged ONNX Runtime WebAssembly. It does not enable remote scripts or unsafe-eval. Browser model/runtime/tokenizer files and licenses are included in the ZIP.

## Debugger justification (drawing)

```text
The optional Auto-Drawer uses chrome.debugger and Chrome DevTools Protocol input commands to perform the drawing the user starts on the Skribbl canvas. It sends trusted mouse presses, held-button moves, releases and tool clicks, and detaches when drawing finishes, is stopped, or fails. The permission supports this implemented drawing feature; it is not used to collect browsing history or monitor unrelated sites.
```

## Skribbl site access / content-script matches

```text
The content scripts run only on https://skribbl.io/*. They read the game's displayed hint and chat, render matching-word suggestions, confirm submitted guesses, and provide the user-controlled drawer panel and game-canvas input. The manifest does not request access to all websites.
```

## Optional loopback host access

```text
Optional access to http://127.0.0.1:8765/* is requested through the extension-owned Local AI setup screen. Both the permission and implementation restrict local service access to port 8765, excluding other loopback ports. It sends images for local line/subject inference, or a typed search query and currently hint-eligible candidate words for local semantic search. Browser image processing and ordinary text/category matching work without this optional access.
```

## Remote code

**Select: No, I am not using remote code.**

```text
All executed JavaScript and WebAssembly, including ONNX Runtime, are included in the package. Browser models, tokenizer and public embeddings are packaged too; remote model/code loading is disabled. Optional public word-list requests return text data only; the optional Python service returns PNG images or JSON scores. Python dependencies/models are separately installed and never executed by the browser extension. No remote script or WASM is downloaded or evaluated.
```

## Data-use descriptions

Use the current [PRIVACY.md](PRIVACY.md) consistently with the listing/form answers. Do not reuse the old blanket statement that no data is ever sent to a server: guesses/drawing input go to the game, optional word-list downloads contact GitHub/jsDelivr, and optional inference contacts the user's local service. This build has no hosted AI provider, API-key requirement, telemetry collector or sale of data. The local service keeps search queries/custom words in memory and caches only bundled public-dictionary embeddings to disk. Preferences and dictionary/removal choices stay in local storage on the device.

## Reviewer reproduction steps for storage

1. Load the submitted extension and open Skribbl. Expand Auto-Drawer and choose Colors + outlines. Changing preferences requires no AI model, local service, login or live drawing turn.
2. Set Drawing speed to Balanced and Drawing target to 90 seconds. Choose a subject/background mode. These persisted user preferences are separate from per-image Auto recommendations.
3. Click Open large viewer. The extension-owned viewer restores the same preferences. Close/reopen that viewer, or restart the browser: they remain saved.
4. In the extension viewer's DevTools console, run `await chrome.storage.local.get(null)`. Changed controls create keys `sagDrawerPreferences.v1.speed`, `.budget`, `.focus`, `.detector` and `.amplify`. A completed drawing can also create `sagEventMs` for timing estimates.
5. The audit uses the actual released package and real extension APIs. Its negative control demonstrates that removing `storage` breaks save/restore.

## Submission handling

Upload the current `dist/skribbl-auto-guesser-2.3.3.zip` as an updated draft, replace outdated justifications/privacy text, and include the storage reproduction steps. The old rejection remains until a new submission is reviewed. This audit addresses the stated unused-storage issue; it does not guarantee Chrome Web Store approval or certify every other policy. No draft, appeal or publication was sent during this audit.
