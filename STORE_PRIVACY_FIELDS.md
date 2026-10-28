# Chrome Web Store submission fields — 2.3.7

Updated October 28, 2026. These descriptions match Skribbl Auto Guesser + Auto Drawer 2.3.7. Replace the older submission text; the rejected 2.1.0 draft does not update itself when local files change.

## Rejection addressed: Purple Potassium / unused storage

The screenshot rejects **2.1.0** for requesting `storage` without using it. The current **2.3.7** package uses `chrome.storage.local` for the AI engine choice, five shared Auto-Drawer preferences and measured drawing-event latency. Legacy guesser settings/word caches separately use the site's `localStorage`.

The 2.3.3 extracted-ZIP audit verified preference writes, sharing across viewers, and persistence after a full browser restart. Version 2.3.7 retains the same permission declarations and storage implementation. Removing `storage` from an isolated test copy made the same save/restore features fail. Keep the permission for these implemented features; do not upload the old rejected ZIP. See [audit evidence](docs/STORE_PERMISSIONS_AUDIT.md).

## Single-purpose description

```text
Help users play skribbl.io with hint-based word search, user-controlled automatic guesses and image-to-canvas drawing tools, with optional AI running on their computer.
```

## Storage justification

```text
chrome.storage.local saves the selected AI engine, Auto-Drawer preferences (speed, target time, subject/background mode, line detector and color amplification), and measured drawing-event latency used for time estimates. These settings persist across browser restarts and are shared between the Skribbl panel and extension-owned viewers. No uploaded images or search history are saved through this permission. Legacy guesser settings and word-list caches separately use the site's localStorage.
```

## Optional Offscreen justification

```text
Optional access requested in Local AI setup when the user selects Chrome CPU/GPU or clicks Load AI models. A packaged offscreen document creates a dedicated worker, using the WORKERS reason, to run packaged AI models for related-word search, subject detection and line detection without blocking the game UI or requiring a permanently visible setup tab. Models run locally using packaged JavaScript and WebAssembly. The document closes when the user unloads models or changes engines. Python mode and ordinary text/category matching do not require this permission.
```

The extension-page CSP enables wasm-unsafe-eval for packaged ONNX Runtime WebAssembly. It does not enable remote scripts or unsafe-eval. Browser model/runtime/tokenizer files and licenses are included in the ZIP.

## Debugger justification (drawing)

```text
Used only for Auto-Drawer input on the user's skribbl.io tab after the user starts drawing. Chrome DevTools Protocol input commands draw strokes and select the game's brushes, colors and fill tool. Chrome displays its debugger notice; the extension waits for startup to settle before drawing. Input is cancelled and the debugger detaches when drawing finishes, the user stops it, or a drawing error occurs. This permission is not used to inspect network traffic, collect browsing history or monitor unrelated tabs. Drawing input is sent to Skribbl as part of gameplay.
```

## Host permission justification — paste into the dashboard field

```text
Content scripts run only on https://skribbl.io/* to read the displayed hint and relevant game feedback, show matching words, submit user-controlled guesses and provide Auto-Drawer canvas controls. Optional access to http://127.0.0.1:8765/* is requested in Local AI setup for the user's Python service. It sends an image for subject/line detection, or the typed query and hint-eligible candidates for related-word search; responses are images or JSON data. This connection is restricted to port 8765. Chrome CPU/GPU AI runs inside the extension without localhost access. No access to unrelated websites is requested.
```

The dashboard field covers both the Skribbl content-script matches and optional loopback origin. Replace the old site-only explanation with the combined text above. Each permission justification is under 1,000 characters. Required permissions remain Debugger and Storage; Offscreen and Python host access remain optional.

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

Upload the current `dist/skribbl-auto-guesser-2.3.7.zip` as an updated draft, replace outdated justifications/privacy text, and include the storage reproduction steps. The old rejection remains until a new submission is reviewed. This audit addresses the stated unused-storage issue; it does not guarantee Chrome Web Store approval or certify every other policy. No draft, appeal or publication was sent during this audit.

## Dashboard guidance

Paste these explanations into the existing item under Privacy practices. Leave No, I am not using remote code selected. Updating these dashboard text fields does not change the extension package or require a new package version. The yellow notice in the dashboard warns that host access may need additional review; the text above explains the implemented access, without promising a review time or approval.

Checked against [Chrome privacy-field guidance](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy), [Offscreen API](https://developer.chrome.com/docs/extensions/reference/api/offscreen) and [Manifest V3 code requirements](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements) on October 28, 2026.
