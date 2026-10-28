# Color count — 2.2.17

## Reproduction

`tests/fixtures/color-count.svg` contains a gray gradient and a small warm brown rectangle (0.75% of image area). Before the fix, at Merge similar colors 14:

| Color count | Simplified palette |
| --- | --- |
| 24 | Dark gray, light gray, brown |
| 3 | Dark gray, light gray; brown disappeared |

The browser regression test failed on the old code and saved [before at 3](../screenshots/validation-2.2.17/before-3.png) and [before at 24](../screenshots/validation-2.2.17/before-24.png). The bug was in simplification itself, before any drawing-time budget/execution.

The old algorithm ran k-means with the requested number of source clusters, then merged them and mapped their averages to the game palette. Several clusters could spend their slots on gray shades mapping to the same swatch. A small colored region could be absorbed by a neutral centroid even though it survived at a higher requested count.

## Change

Color analysis now uses a fixed detailed candidate count (up to the 26 game swatches), independent of the requested 2–24 limit. Similar representative LAB shades are merged and mapped to actual game colors first. If there are too many distinct swatches, a deterministic backward reduction chooses which actual palette colors to retain using perceptual error, sublinear painted-area weighting and source chroma. A meaningful chromatic group cannot be reduced to an entirely neutral palette merely to retain another gray band. This guard requires real source chroma and a minimum area; it does not colorize grayscale inputs.

Removed swatches map to a surviving swatch rather than generating new averaged hues. Analysis and reduction yield for cancellation. No changes were made to image crops, AI inference, palette clicking, continuous mouse input or drawing order.

The color target is still a maximum per layer. Merge strength, a limited game palette, tiny-speckle removal, implicit white canvas, added outlines, separate subject/background layers and budgeted fills can make target/simplified/drawing counts differ. The UI reports those counts separately. `sourceColors` now counts the actual nontransparent simplified pixels after speckle merging, and combined layers when enabled, rather than a stale pre-merge palette or foreground-only count.

## Checks

The same fixture now has identical simplified PNGs at targets 3 and 24, including its brown patch. Its final plan contains the brown fill, and a central final-preview pixel is the expected game RGB `(204,119,77)`. Compact and large viewers produce identical plans. The 24-distinct-color fixture still retains all 24 at merge zero.

Node checks cover the exact mismatch, targets 2/3/6/24 on a neutral scene with a colored accent, choosing existing hues instead of new gray averages, true grayscale inputs, bounded counts, merging, alpha, crops, subject ordering and deterministic reprocessing. Browser checks exercise the new regression, target/stats, final-preview color, compact-session equality and existing drawing workflows.

Passed: **55 Node tests** and **43 Chrome drawer tests** (the full UI suite excluding the unrelated guesser suite), including real local line/subject AI, native CDP execution, palette verification, Stop/Escape, cached playback, crop/selection editing, 24 colors and saved preferences. JavaScript syntax and manifest references are checked when packaging.

Artifacts: [after at 3](../screenshots/validation-2.2.17/after-3.png), [after at 24](../screenshots/validation-2.2.17/after-24.png), [panel](../screenshots/validation-2.2.17/3-color-panel.png), [counts](../screenshots/validation-2.2.17/color-count.json). Before/after images were visually inspected.

Reload the extension and refresh Skribbl, then process the image again. For the local viewer use Ctrl+Shift+R; no Python-service restart is required. Package with `npm run package` for `dist/skribbl-auto-guesser-2.2.17.zip` and its SHA256 manifest.
