# Chrome Web Store permission audit — 2.3.0

The original storage rejection was audited in 2.2.27. Version 2.3.0 adds an actively used offscreen permission for in-Chrome AI and stores the selected AI backend. Real extension integration tests verify offscreen creation, model inference, worker closure on engine change and persistence after restart; see [browser AI evidence](BROWSER_AI.md). The historical storage negative-control evidence below remains applicable. Use the current release ZIP and submission text rather than the older filename mentioned in historical results.

Date: October 27, 2026. Scope: the screenshot's **Purple Potassium / requesting but not using storage** rejection for version **2.1.0**, and the current packaged manifest. This is not a guarantee of Google approval or a full store-policy certification.

## Finding

The specific unused-storage condition does not describe the current implementation. `storage` is actively used by implemented Auto-Drawer features:

| Actual API usage | Feature | Implementation |
| --- | --- | --- |
| `chrome.storage.local.get` / `.set` | Share and persist speed, target time, subject/background mode, detector and amplification | `drawer-studio.js`: preference helpers and input handlers |
| `chrome.storage.local.set({sagEventMs})` | Save observed drawing-event latency | `drawer.js`: plan executor completion |
| `chrome.storage.local.get('sagEventMs')` | Estimate drawing time using observed latency | `drawer-studio.js`: processing completion |

Legacy guesser settings and dictionary caches use website `localStorage`; that alone would not justify the extension permission. The previous store-form template mixed these systems and contained outdated network/privacy statements. `STORE_PRIVACY_FIELDS.md` now accurately describes current usage and gives reviewer reproduction steps.

Chrome requires the `storage` permission for its extension Storage API. Its policy requires permissions to support implemented features and use the least necessary access. This usage supports the current permission through real functionality. [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage), [Use of Permissions policy](https://developer.chrome.com/docs/webstore/program-policies/permissions).

## Manifest review

| Requested access | Current use | Result |
| --- | --- | --- |
| Required `storage` | Shared persistent drawer preferences and observed drawing latency | Used |
| Required `offscreen` | Packaged worker for in-Chrome models; created with WORKERS and closed on unload/engine change | Used; real extension inference verified |
| Required `debugger` | User-started trusted drawing/tool input through CDP; cancellation/release/detach | Used |
| Content-script matches `https://skribbl.io/*` | Hints/chat, suggestions, guess submission and drawer integration | Restricted to the game site |
| Optional `http://127.0.0.1:8765/*` | Explicit Local AI setup; manifest, permission request and background check fix the port | Optional, restricted to 8765, and checked before access |

No `tabs`, `scripting`, `activeTab`, `unlimitedStorage` or all-sites host permission is requested. Opening the packaged large viewer with `chrome.tabs.create` does not require adding the sensitive `tabs` permission. [Chrome Tabs API permissions](https://developer.chrome.com/docs/extensions/reference/api/tabs#permissions).

The extension's JS, page bridge and imported transport are packaged. Public word-list downloads are text; local AI returns PNG/JSON. No remotely downloaded JS/WASM executes in the browser. Python inference is a separate local installation. [Chrome remote-hosted-code guidance](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code).

## Real loaded-extension verification

`tools/verify-permissions.cjs` ran against an extracted **release ZIP**, using isolated persistent Chromium profiles and real extension APIs, without storage stubs or a Python service:

1. Loaded the packaged extension and opened its extension-owned Drawing Studio.
2. Uploaded a benign local fixture and changed all five persisted preferences through the actual controls.
3. Read the resulting keys using real `chrome.storage.local` from the background worker.
4. Opened another extension viewer: all preferences restored.
5. Closed the whole browser and reopened the same isolated profile: all preferences restored again.
6. Created a test-only copy with just the `storage` permission removed. The same code reported both **Could not restore drawer preferences** and **Could not save drawer preferences**. The original ZIP/source were not modified by this control.

Observed storage:

```json
{
  "sagDrawerPreferences.v1.amplify": 70,
  "sagDrawerPreferences.v1.budget": 90,
  "sagDrawerPreferences.v1.detector": "ai",
  "sagDrawerPreferences.v1.focus": "subject-background",
  "sagDrawerPreferences.v1.speed": "balanced"
}
```

The audit also tested a clone with the declared loopback origin granted at install: Chrome's actual matcher allowed 8765, rejected 8766, and rejected whole-host access. This avoids requesting a live grant in the user's browser or contacting a service. Port-specific patterns are supported by the [official match-pattern documentation](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns). The former all-port loopback pattern was narrowed in this release, including setup and background checks.

Actual grants in the regular package were `debugger` and `storage`, plus Skribbl site access. Optional loopback access remained ungranted: persistence does not need AI access. No live game was opened or game input sent. The drawing-latency storage path was inspected in packaged source; it was not exercised by drawing in a room.

Evidence: `screenshots/store-permission-audit/report.json`, `real-storage-restored.png` and `without-storage-permission.png`. Testing used an installed Playwright Chromium build as recommended by the [official extension-testing documentation](https://playwright.dev/docs/chrome-extensions), not the user's browser session.

## Reproduce and resubmit

Extract the current ZIP and run from the project:

```powershell
node tools/verify-permissions.cjs <extracted-extension-directory>
```

The script uses an installed Playwright Chromium build; `SAG_AUDIT_CHROMIUM` can specify its executable. Isolated profiles go under `test-results/`; evidence goes under `screenshots/store-permission-audit/`.

Use the corrected storage justification and reproduction steps in `STORE_PRIVACY_FIELDS.md` with an updated draft. The old 2.1.0 dashboard rejection does not disappear from editing local files. Google makes the final decision. No draft, appeal or publication was sent during this audit.
