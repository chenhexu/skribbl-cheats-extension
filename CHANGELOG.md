# Release notes

## 2.3.7

- Rename the extension to Skribbl Auto Guesser + Auto Drawer and update the package summary to cover word search, automatic guesses, image drawing and optional local AI.
- Refresh the store listing text, privacy justifications and submission kit; include five cropped user screenshots and three alternatives.
- Add real drawing and related-search screenshots to the README, organize source branding, image fixtures and archived experiments, and preserve original loose captures/installers under an ignored local folder. Runtime entry-point paths remain unchanged.
- Drawing behavior, permissions and model assets are unchanged from 2.3.6.

## 2.3.6 — local preview

- Attach the drawing debugger before any game input, then wait at least 400 ms and for 200 ms of stable canvas/viewport layout. The pause applies even when the canvas coordinates do not change; Chrome keeps its debugger notice visible.
- Measure the canvas after startup settles. Stop promptly if the canvas or viewport moves during drawing, releasing held input before continuing to a bucket fill. Stop remains responsive during the startup pause.
- Verify with trusted Chrome input: unchanged coordinates, delayed viewport resize and animated canvas layout, interrupted boundaries, startup cancellation, brush selection and executor regressions. These checks simulate the banner timing/layout; they do not automate the native Chrome infobar.
- Includes the single-manifest Web Store package fix and independent Outline detail control. Permissions are unchanged.

## 2.3.5 — local preview

- Fix Chrome Web Store upload rejection caused by a second file named `manifest.json`. AI model provenance and hashes now use `browser-ai/models/model-index.json`; the root extension manifest keeps its required name.
- Update model packaging, export/restore tools and notices. Validate exactly one root manifest in both the package allowlist and completed ZIP; regression checks reject nested or duplicate manifests.
- Includes the independent Outline detail control from 2.3.4. Model weights and permissions are unchanged.

## 2.3.4 — local preview

- Outline detail is independent of Auto settings. Adjusting it keeps Auto enabled, preserves the other suggestions, and invalidates only the old drawing plan.
- Changing detail while Auto is still choosing settings no longer cancels the suggestion. Compact-panel and large-viewer sessions retain the independent Auto/detail values.

## 2.3.3

- Resize the floating Auto-Drawer from all four edges and four corners, including the top edge. Resizing preserves the opposite edge and uses the actual border-box size.
- Remove the forced gap at browser edges for the drawer and guesser, and allow resizing up to the available viewport height. Keep panels reachable after shrinking the browser window.
- Make Offscreen optional, requested only when enabling Chrome AI. Required permissions are now Storage and Debugger; optional Python access remains restricted to port 8765. Recheck permission usage and real browser grants.
- Ship the narrow parallel-line pencil planning from 2.3.1 and AI message-channel recovery from 2.3.2, described below.

## 2.3.2 — local preview

- Reconnect semantic word search automatically after Chrome closes its message channel. Retry an interrupted request once with a fresh ID; preserve the current hint bank and cancel the abandoned request.
- Retry interrupted offscreen connections once and recreate a failed inference worker. Keep genuine model/configuration failures visible instead of switching engines.
- Keep the background broker active during bounded AI work and settle cancelled or unanswered requests promptly. Clear keep-alive timers when work ends.
- Verify recovery in a loaded extension by closing the AI document and stopping the background worker during real semantic searches. Both queries finish without retyping; existing hint filtering, image inference and saved-engine checks pass.
- Includes the 2.3.1 narrow-line drawing improvements below.

## 2.3.1 — local preview

- Extend pencil planning to 4–6px curved ink and larger connected groups, which were excluded by the previous 7px minimum and 12-path limit.
- Pair inner/outer boundaries across each center path and prefer pencils when at least 90% of sampled tangent pairs agree. Validate the raster footprint and preserve holes before accepting the plan.
- Use bounded center adjustments, a few offset passes or short corrections for widths between available game pencils. Preserve clipped canvas ends and avoid duplicate passes that add no source coverage.
- Reserve the narrow pencil's antialias fringe in footprint checks, preventing underestimated coverage from leaving thin spots or dotted corrections.
- Compare fallback cost against actual bucket compartments; retain ordinary fills for irregular shapes that cannot pass the geometry checks.
- Validate the supplied plan through a private contour reconstruction; add generated narrow-curve and branch regression cases. Uploaded user artwork and JSON are excluded from the source repository.

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
