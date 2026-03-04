# Skribbl Auto Guesser – Chrome Extension

Standalone Chrome extension project for the Skribbl.io Auto Guesser. Runs only on `https://skribbl.io/*`.

**Related repo:** The userscript source and word-list app live in [Skribbl_hints](https://github.com/chenhexu/skribbl.io_hints_remastered) (sibling folder `Skribbl_hints`). This folder is a separate project so the extension (and future features like auto-drawer) can be developed and versioned independently.

- **Privacy:** [PRIVACY.md](PRIVACY.md) — extension does not collect user data.
- **License:** MIT (see [Skribbl_hints/LICENSE](https://github.com/chenhexu/skribbl.io_hints_remastered/blob/main/LICENSE)).

## Development / load unpacked

1. Open `chrome://extensions/`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this folder.

## Icons (for Chrome Web Store)

The manifest has no `icons` entry by default so the extension loads unpacked without extra files. For store submission, add an `icons` folder and this to `manifest.json`:

```json
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
```

Use 16×16, 48×48, and 128×128 PNGs.

## Updating from the userscript

The script is generated from the userscript in the Skribbl_hints repo:

1. Open `Skribbl_hints/skribbl-hints-app/public/userscripts/skribbl-auto-guesser.user.js`.
2. Remove the header (lines 1–8, from `// ==UserScript==` through `// ==/UserScript==`).
3. Save the rest as `content.js` in this folder.
4. Bump `version` in `manifest.json` to match the script version.

## Publishing to Chrome Web Store

1. Create a ZIP of this folder (contents only: `manifest.json`, `content.js`, `icons/` if present).
2. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
3. **New item** → upload the ZIP → fill listing (description, screenshots, category) → submit.
