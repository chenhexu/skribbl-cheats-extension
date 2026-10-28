Hint-aware related-word search, a refined image Auto-Drawer, and three local AI choices: **Chrome GPU**, **Chrome CPU**, or an optional **Python terminal service**.

### Download and install

Download **skribbl-auto-guesser-2.3.0.zip**, extract it, then open `chrome://extensions` → Developer mode → Load unpacked and select the extracted folder. Refresh Skribbl after loading or updating. Disable older copies to avoid duplicate panels.

The extension ZIP includes all browser AI models and runtimes. **No Python, npm, paid AI account or API key is required for Chrome modes.** Open Local AI setup, explicitly choose Chrome CPU/GPU and click Load AI models before playing. The existing default remains Python until changed. GPU support depends on the browser and graphics driver; Chrome CPU is an alternative.

### Highlights

- Search spelling, categories and meaning within the detected hint's word lengths, spaces and revealed letters. Choose relevance or alphabetical sorting, inspect match reasons, and clear the search automatically on a new round.
- Review image previews, use full scenery or a selected subject, correct subject parts manually, amplify dark colors and simplify up to 24 colors per layer.
- Auto settings choose per-image suggestions while preserving manual Outline detail. Drawing speed, target and subject/background preferences are remembered.
- Start/Stop guessing and drawing remain user controlled, with chat-delivery confirmation, spam recovery and improved drawing cancellation.
- Suitable thick lines use a wider pencil rather than thin boundary tracing followed by Fill; shape checks preserve the fallback for irregular regions.
- Dedicated AI setup shows readiness and measures word-search speed. Chrome inference uses packaged local models; Python remains optional.

[Usage guide](https://github.com/chenhexu/skribbl-cheats-extension/blob/main/docs/USAGE.md) · [Changes](https://github.com/chenhexu/skribbl-cheats-extension/blob/main/CHANGELOG.md) · [Privacy](https://github.com/chenhexu/skribbl-cheats-extension/blob/main/PRIVACY.md) · [Report issues](https://github.com/chenhexu/skribbl-cheats-extension/issues)

Source archives exclude generated model binaries. Developers can restore verified models from the extension ZIP using `tools/restore-browser-models.ps1`; see the development guide. The adjacent `.zip.json` contains the extension package's SHA256 and source revision.

**chrome-web-store-kit-2.3.0.zip** contains listing text, current screenshots, icons, permission explanations and reviewer instructions. It is a submission companion, not the installable extension. No Chrome Web Store submission or publication has been performed.

Validation includes 82 Node checks, 13 Python tests, browser regressions and real CPU/GPU extension inference. Performance and foreground selection depend on the device and image; review previews before drawing. See repository validation notes for scope and evidence.
