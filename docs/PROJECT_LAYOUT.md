# Project layout

| Location | Purpose |
| --- | --- |
| `manifest.json`, root JavaScript and `ai-setup.*` | Chrome extension entry points, game integration, drawing and search |
| `browser-ai/` | In-Chrome inference, model metadata, tokenizers and licenses |
| `dev-line-art/` | Extension-owned drawing viewer and legacy filter viewer |
| `ai-service/` | Optional Python companion service |
| `icons/` | Packaged extension icons |
| `assets/branding/` | Original icon and promotional artwork |
| `store/` | Listing text, submission instructions and screenshot preparation records |
| `store/screenshots/` | Five numbered listing screenshots |
| `store/screenshot-alternates/` | Three alternative listing crops |
| `store/references/` | Unmodified user-supplied screenshot originals |
| `screenshots/` | Browser/validation evidence and older captures under `legacy/` |
| `tests/fixtures/` | SVG/generated fixtures and the supplied line/photo test inputs |
| `tests/`, `tools/` | Automated checks, build, packaging and validation scripts |
| `archive/` | Earlier implementations and retired image tooling |
| `docs/` | Usage, development and historical validation notes |
| `dist/` | Ignored build ZIPs, metadata and local verification output |
| `local/` | Ignored original loose captures and old installers preserved during cleanup |

The runtime entry points remain at the root so the Chrome manifest and existing unpacked installations keep their paths. The extension packager uses an explicit allowlist: artwork originals, screenshots, archives, tests and the Python service do not enter the installable ZIP.

AI model binaries and the generated browser worker/runtime are distributed in release assets rather than committed to Git. Follow [Development](DEVELOPMENT.md) to restore a source checkout.

The exact ZIP submitted for store review on October 28, 2026 is retained locally in `dist/submitted/2.3.7/`. Source cleanup and GitHub publishing do not change that dashboard submission. The Chrome Web Store listing is awaiting review; no store installation URL is available yet.
