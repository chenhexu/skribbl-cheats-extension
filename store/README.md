# Chrome Web Store submission kit — 2.3.3

Prepared October 28, 2026. This kit is ready for the developer dashboard; it does not submit or publish the extension. The package must still pass Google's review. Use the current 2.3.3 ZIP, not the rejected 2.1.0 draft.

## Listing fields

| Field | Prepared value |
| --- | --- |
| Name | Skribbl Auto Guesser |
| Version | 2.3.3 |
| Short description | Hint-aware word suggestions and an image Auto-Drawer for skribbl.io, with optional AI that runs on your computer. |
| Detailed description | Copy [store-listing-description.txt](../store-listing-description.txt); plain text, no Markdown formatting required. |
| Language | English |
| Suggested category | Games, if available in the current dashboard |
| Homepage | `https://github.com/chenhexu/skribbl-cheats-extension` |
| Support | `https://github.com/chenhexu/skribbl-cheats-extension/issues` |
| Usage guide | `https://github.com/chenhexu/skribbl-cheats-extension/blob/main/docs/USAGE.md` |
| Privacy policy URL | `https://github.com/chenhexu/skribbl-cheats-extension/blob/main/PRIVACY.md` |

The homepage, support and privacy links become current once the source commit is pushed. The publisher must supply/verify their own developer account email and distribution settings in the dashboard; no account identity is invented in this kit.

## Upload files

- **Extension:** `dist/skribbl-auto-guesser-2.3.3.zip`, produced by `npm run package`. Its adjacent `.zip.json` records SHA256, source revision and the exact allowlist. Do not upload the repository's source-code ZIP or this submission folder as the extension.
- **Store icon:** [128px PNG](../icons/icon128.png), also referenced by the packaged manifest. Smaller icons are included for Chrome UI.
- **Screenshot 1:** [Drawing Studio](assets/drawing-studio-1280x800.png).
- **Screenshot 2:** [Hint-aware related search](assets/word-search-1280x800.png).
- **Screenshot 3:** [Local AI setup](assets/ai-setup-1280x800.png).
- **Optional small promo tile:** [440 × 280 PNG](assets/promo-440x280.png).

For a portable copy of these descriptions, images and guides, run `powershell -NoProfile -ExecutionPolicy Bypass -File tools/package-store-kit.ps1`. This creates `dist/chrome-web-store-kit-2.3.3.zip`, separate from the installable extension ZIP.

Screenshots show actual extension UI in isolated demonstration pages using project-owned sample artwork. The word-search screenshot uses synthetic game markup; no real players, chat logs or game results are shown. They do not claim that the extension is endorsed or featured by Chrome.

Google currently requires an icon and at least one screenshot. The 128px icon belongs inside the extension ZIP; listing screenshots use 1280 × 800. The small promo tile is optional. Sources: [Supplying images](https://developer.chrome.com/docs/webstore/images), [Listing fields](https://developer.chrome.com/docs/webstore/cws-dashboard-listing), checked October 28, 2026.

## Privacy and permissions

Use [STORE_PRIVACY_FIELDS.md](../STORE_PRIVACY_FIELDS.md) for the single purpose, Storage, Offscreen, Debugger, Skribbl access, optional loopback access and remote-code answers. Use [PRIVACY.md](../PRIVACY.md) as the public policy. Do not reuse the obsolete claim that nothing ever contacts a server: guesses/drawing go to the game; optional word-list downloads use GitHub/jsDelivr; optional Python inference uses loopback.

The developer operates no analytics, hosted inference or collection server. Images, queries, custom dictionary and preferences are processed/stored on the device; user-started input goes to the game. Review each live data-use checkbox against that behavior and the linked policy before certifying. Account contact information and store distribution settings must be entered by the publisher.

Select **No, I am not using remote code**: executed JavaScript/WASM is packaged, remote model loading is disabled, and optional server responses are PNG/JSON/text data. The packaged wasm-unsafe-eval CSP enables local WebAssembly. See Google's [privacy fields guidance](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy).

## Reviewer notes — copy into testing instructions

```text
No login, API token, paid service or terminal is required for Chrome AI. Open skribbl.io and use Local AI setup beneath the search field or in Auto-Drawer. Choose Inside Chrome - CPU and click Load AI models; wait for all three features to report ready. Chrome GPU is optional and hardware-dependent. The initial saved engine remains Python until changed explicitly.

Storage review: change Drawing speed, Drawing target or Subject and background in Colors + outlines. Open large viewer; it restores those shared preferences. Close/reopen it or restart Chrome; the preferences remain. Changing the AI engine in Local AI setup is also persisted. No live drawing turn or AI model is needed to test drawer preference storage. Detailed reproduction steps and real loaded-extension negative controls are documented in STORE_PRIVACY_FIELDS.md and docs/STORE_PERMISSIONS_AUDIT.md in the public repository.

Drawing: upload an image, leave Use main subject off for full scenery, click Process image and inspect Final drawing. Actual Start drawing is available in the Skribbl panel during the user's own drawing turn, with the game's canvas/tool controls visible. Chrome displays its debugger notice during this user-started input session; Stop cancels and detaches it. The large extension viewer only processes/previews images.

Word search waits for a displayed hint. Related words searches only currently hint-eligible words and spaces. Text/category matching works without AI; Chrome CPU/GPU adds packaged local model inference. Python is a separately installed optional companion and is not required for normal review.

This 2.3.3 draft supersedes the 2.1.0 draft rejected for unused storage (Purple Potassium). Storage now implements shared drawer preferences, the AI engine choice and drawing-latency measurements. The current package actively uses it; please review this new package and updated justifications.
```

## Final dashboard steps

1. Open the existing item in the Chrome Web Store Developer Dashboard and upload the new extension ZIP as an updated draft.
2. Replace the old beta description, screenshots and privacy/permission answers with this kit. Verify the public privacy/support links after the GitHub push.
3. Add reviewer notes, verify developer contact details, choose distribution/visibility and confirm the uploaded version is 2.3.3.
4. Review the dashboard's warnings and preview. Submit when you are ready; publish according to your chosen review/distribution setting.

The earlier rejection cannot be cleared by editing local files alone. A new upload/review is required. Technical validation addresses the reported permission issue and does not guarantee acceptance.
