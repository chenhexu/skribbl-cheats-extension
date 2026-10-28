# Remembered Auto-Drawer preferences — 2.2.15

Since 2.2.21, color amplification strength is also an explicit user preference. It uses the same per-field storage and restoration rules, adding a fifth primitive value. Auto keeps this choice. See [amplification validation](AMPLIFY_COLORS_VALIDATION.md). The original four-preference implementation and its historical checks are described below.

The shared drawer UI saves explicit user changes to the four controls that Auto does not choose: line detector, drawing target, drawing speed and subject/background mode. Chrome's `storage.local` shares them between the content-script panel and extension-owned viewer. The standalone local viewer uses localStorage scoped to its address instead; it does not share preferences with the extension or other ports.

Only these four primitive values are persisted under `sagDrawerPreferences.v1.*`. No image, crop, subject mask, plan or Auto-generated color/detail settings are saved. Subject mode can be remembered without a mask; the UI asks the user to find or mark the subject for the new image. Programmatic image/session changes do not overwrite the user's saved defaults. Auto/manual checkbox behavior remains unchanged.

Each control has its own storage key so a stale open viewer changing one preference cannot overwrite another view's other choices. Writes are serialized within each UI script context. Restoration validates select values and drawing-target bounds, and skips controls edited while storage was loading. Image-session restoration waits for saved defaults and then applies the explicit session, giving that session precedence. Storage failures are handled and displayed while leaving the drawer usable. The mount API exposes `ready` for callers/tests that need to await initial preference restoration.

Validation covers local-viewer reload, uploading another image with Auto, fresh extension-viewer/compact mounts against a shared extension-storage fixture, edits from a stale second viewer, explicit session precedence, delayed restore versus user edits, invalid detector values, and write failure. Browser checks also cover existing Auto/manual handoff, crop/session transfer, identical repeated plans, playback/stale plans and Stop/Escape. The extension-storage fixture uses the same Chrome storage interface with deterministic backing data; it does not load an actual unpacked extension into a public game room.

Passed: **51 Node tests** and **11 targeted Chrome tests**. JavaScript syntax and manifest/package references are checked by `npm run package`.

The screenshot [remembered preferences](../screenshots/validation-2.2.15/remembered-preferences.png) was visually inspected: restored AI detection, 90-second target, Balanced speed and subject-first/background-later remain selected while Auto chooses fresh color/detail settings for the new image.

Reload the extension at `chrome://extensions`, then refresh Skribbl. Choose these preferences once; later reloads restore them. No Python restart is required; hard-refresh the local viewer if using it. Package with `npm run package`, producing `dist/skribbl-auto-guesser-2.2.15.zip` and its SHA256 manifest.
