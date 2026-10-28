# Release notes

## 2.3.0

- Run semantic word search, foreground detection and AI line detection inside Chrome using WebGPU or CPU. Keep the Python companion service as an explicit alternative.
- Dedicated Local AI setup explains each engine, warms the three models, shows readiness, measures word-search speed and unloads browser models.
- Related-word search combines spelling, curated categories and optional local neural embeddings within the current hint bank. Closest-first and alphabetical ordering, relevance colors, multiword phrases and broader animal/insect coverage are available.
- Improved hint parsing after guessed-state recovery, bundled dictionary upgrades, stale search cancellation and new-round search reset.
- Confirm chat delivery and recover from spam rejection without permanently marking rejected guesses as sent.
- Colors + outlines image workflow with per-image Auto settings, up to 24 colors, color amplification, manual outline detail, subject-first/background planning, scenery mode and editable subject parts.
- Improved game palette selection, brush detection, drawing-turn detection, stop cancellation and path preview playback.
- Use wider game pencils for suitable thick lines, avoiding redundant thin boundary traces and bucket clicks while retaining a checked-shape fallback. See [wide-pencil validation](docs/THICK_LINES_VALIDATION.md).
- Remember shared drawer preferences; expand the drawer when undocking; keep the pinned action row compact.
- Bundle AI code, runtime, weights and licenses in the downloadable extension. No hosted inference account or terminal is needed in Chrome modes.
- Add current user/build guides, store listing assets and permission-review instructions. The old 2.1.0 storage rejection is addressed by implemented, tested storage usage in this package.

Validation includes 82 Node checks, 13 Python tests, browser regressions, real loaded-extension CPU/GPU inference, backend persistence and permission negative controls. See [browser AI details](docs/BROWSER_AI.md) and the validation documents under `docs/` for scope and limits.

Earlier development notes are preserved in [the historical README archive](docs/HISTORY.md). They describe older intermediate builds; use the current README and usage guide for installation.
