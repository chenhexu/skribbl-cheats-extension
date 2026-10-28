# Privacy Policy — Skribbl Auto Guesser

**Last updated:** October 28, 2026

**Chrome Web Store:** For the Privacy form fields (single purpose, permission justifications, remote code), use the copy-paste text in [STORE_PRIVACY_FIELDS.md](STORE_PRIVACY_FIELDS.md).

The extension has no analytics or telemetry collector and does not sell user data. Its content scripts run only on `https://skribbl.io/*`. Guesses and drawing input are sent to the game when you use those features.

## Data collection

Browser image processing happens on your device. Uploaded images/crops stay in memory for processing and preview. Opening the large extension viewer temporarily transfers the image/settings through the extension background worker; preview sessions are consumed on opening or expire. Images are not uploaded to a hosted inference provider.

**AI setup** lets you choose Chrome GPU, Chrome CPU, or the Python service. Chrome modes run packaged models in an extension-owned worker. Images, queries and eligible candidate words remain on your computer. AI code, WebAssembly, weights, tokenizer and public dictionary embeddings are included in the extension, without runtime downloads from a model provider.

With **Python service** selected and loopback permission granted, **Informative Drawings AI** and **Find main subject (AI)** send the normalized image only to `http://127.0.0.1:8765`. The service returns line art or a U2NETP mask, keeps up to eight line-art results in memory, and does not save uploaded images to disk. With Chrome selected, those models run inside the extension without loopback access. Subject masks/editor preferences are included in temporary viewer-session transfers. Manual **Mark subject** and **Edit subject parts** remain browser-only algorithms; their selection history and color groups stay in memory. No hosted AI provider receives these images.

The extension ZIP includes browser AI models, runtimes and licenses. Optional Python dependency/checkpoint installation separately downloads files from their distribution services; those Python files are not included in the ZIP.

**Related words** combines browser-only spelling/category matching with optional semantic AI. After a typing pause it passes the query and hint-filtered candidates (including eligible custom words) to the selected local engine. Chrome modes use the extension worker; Python mode sends them only to `http://127.0.0.1:8765/api/word-search` after loopback permission is granted. No chat history or unrelated custom dictionary entries are sent. MiniMax and hosted AI providers are not contacted; no API key is needed. With Related words off, no semantic-search requests are made.

The panel caches up to 32 semantic result sets in memory. With Related words enabled, it checks readiness of the selected engine before typing and polls during startup warmup. In Python mode, the service preloads the installed model and bundled public dictionary at startup. It keeps up to 20,000 normalized candidate embeddings and 128 query embeddings in memory until it exits. It does not persist submitted queries, candidate lists, custom words or search results to disk. It saves only the bundled public word bank and its model embeddings in `ai-service/checkpoints/word-search/bundled-embeddings.npz`, so later restarts can reuse that public data. The file contains no query embeddings and stays outside the extension ZIP. Standard local HTTP logs show the endpoint/status, not request bodies. Related words and Closest first preferences use the existing browser-local settings storage. First-time model setup downloads the pinned MiniLM model and its license from Hugging Face/Apache; subsequent inference loads local files only.

On a cold start the legacy guesser may download public word lists from GitHub or jsDelivr. Those requests reveal ordinary connection information to those services; they do not intentionally include guesses, uploaded images, or your custom words.

## What is stored locally

The Chrome AI engine keeps up to 20,000 candidate vectors and 128 query vectors in memory. It can be unloaded in AI setup and is released when changing engines or closing the browser. Its packaged public vectors contain only the bundled public dictionary. Queries, custom vectors and browser AI image results are not persisted by this engine. AI setup stores your selected engine in extension-owned storage.

The extension stores the following **only on your device** (in your browser’s local storage), so it can work across sessions:

- Your preferences (e.g. panel position, delay, dot prefix, refresh rates, Auto-Drawer speed, subject/background mode, line detector, drawing target and color amplification strength)
- Optional custom word list, cache, and explicit word-removal choices

These preferences and custom-word data stay on your device. The five Auto-Drawer preferences and observed drawing-command latency use extension-owned local storage, shared by the extension panel and expanded extension viewer. The optional standalone local viewer uses its own browser localStorage for these preferences. Saving drawing preferences does not save uploaded images, crops or subject masks. Preview PNGs/plan JSONs are downloaded only when you click their download buttons.

The existing dictionary cache also records the extension version last merged and normalized words explicitly removed through the editor. This lets new bundled words appear without losing custom entries or reintroducing recorded removals. No new external dictionary request is required for this migration.

## Permissions

- **Host access (skribbl.io):** Used only to read the game hint and guess input on skribbl.io so the extension can suggest words and send guesses. It does not run on other sites.
- **Storage:** Stores the selected AI engine, Auto-Drawer preferences and local drawing-command latency measurements. Legacy preferences/cache still use the site's localStorage.
- **Optional Offscreen:** Requested when you choose a Chrome AI engine or click Load AI models. Hosts a packaged dedicated worker for Chrome AI so models can stay available while playing without a permanent extra visible tab. It is released when unloaded, changing engines, or closing the browser.
- **Debugger:** Used only for the optional Auto-Drawer feature when drawing via Chrome DevTools Protocol (CDP). The extension attaches to the page to simulate mouse input on the game canvas. No data is sent elsewhere; the debugger is used only on the skribbl.io tab you are using.
- **Optional loopback host access:** Allows contact with the local AI service only through `http://127.0.0.1:8765/*`. Both the requested permission and implementation restrict the port to 8765.

## Changes

If this policy changes, the “Last updated” date will be revised.

## Contact

For questions, [open an issue on the project's GitHub repository](https://github.com/chenhexu/skribbl-cheats-extension/issues) or use the contact email on the Chrome Web Store listing when available.
