# Scenery and optional subject selection — 2.2.19

In 2.2.23, checking Use main subject also authorizes Process image to find a missing subject automatically. Existing selections are reused, and unchecked full-image mode still skips subject inference. The original 2.2.19 behavior described below has been updated; see [automatic subject processing](SUBJECT_PROCESS_VALIDATION.md).

## Findings and changes

The reported screenshot uses Subject first, background later. That existing mode intentionally paints a background using no more than three colors and broad horizontal brush strokes, without background outlines. Raising Outline detail does not change that background policy. Hiding the mode under advanced settings made this easy to miss.

The sticky workflow now includes a **Use main subject** checkbox beside Find main subject (AI), and an always-visible **Draw** menu:

- **Full image / scenery**: use the existing full-image color/outline pipeline and ignore any subject mask.
- **Subject only (fastest)**: draw the selected foreground.
- **Subject first + simplified background**: finish the subject before the existing optional, simplified background.

Clicking Find main subject explicitly enables subject selection. Processing never initiates subject inference itself. If a remembered subject mode has no selection for the current image, processing explains how to select a subject or uncheck the checkbox. A failed AI request still reports its error and supports manual marking. Unchecking keeps the mask, crop and manual values; rechecking restores the previous subject mode within the current studio. The full-image choice is saved in the existing per-field focus preference. Auto reanalyzes the full image when enabled. Crop to subject remains a separate explicit action; Reset crop removes an existing crop.

Turning the checkbox off invalidates the old plan and cancels pending inference. The generation/signal checks prevent a late response from re-enabling a subject or replacing the full-scene plan. The compact panel and expanded viewer share these controls and behavior.

## Outline fixes

Even in full-image mode, different source shades can map to the same limited game-palette swatch. A relatively weak RGB edge then had neither a strong enough source gradient nor a simplified-label boundary to seed detection. Browser detection now also tests perceptual contrast across a sharp transition with flat samples on each side. This retains important low-poly boundaries while rejecting small texture fluctuations and gradual shading. Sampling is bounded, transparent/removed pixels cannot supply support, and the small LAB cache is bounded. The AI line detector still uses its requested model output.

The regression also exposed thinning erasing a two-pixel diagonal stripe from its ends until almost nothing remained. Thinning now uses Guo–Hall connectivity rules; [OpenCV's primary implementation](https://github.com/opencv/opencv_contrib/blob/4.x/modules/ximgproc/src/thinning.cpp) documents the mathematical tests used for reference. No OpenCV dependency or lookup-table copy was added. Continuous tracing, corner fitting, palette mapping and drawing execution are unchanged.

## Reproductions and artifacts

The repository's `subject-parts.svg` is a controlled dinosaur, mountain and forest scene, rather than the user's attached thumbnail. An explicit mask selects the dinosaur/trees while omitting the mountain. At colors 24, merge 12, detail 100 and target 60 seconds, the focused mode loses the mountain outline; unchecking Use main subject restores it while preserving every other processing setting, crop and mask. The fixture's source warm gray and mountain gray can share a game swatch, so restoring outlines does not promise exact original colors.

Visually inspected: [simplified background mode](../screenshots/validation-2.2.19/simplified-background.png), [full scenery](../screenshots/validation-2.2.19/full-scenery.png), [full scenery with Auto](../screenshots/validation-2.2.19/auto-full-scenery.png), [expanded controls](../screenshots/validation-2.2.19/scenery-controls.png), and [compact controls](../screenshots/validation-2.2.19/scenery-compact.png). [Measurements](../screenshots/validation-2.2.19/scenery-comparison.json) report plan estimates and counts, not a live-room drawing-time benchmark.

New browser checks cover remembered subject mode without implicit inference, full-image persistence, unchanged crop/settings/mask, restored mountain paths, re-enabling the retained mask/mode, 320-pixel layout and canceling a delayed AI result. Node regressions verify a low-contrast mountain whose colors map to one gray, suppression of faint texture/soft shading, and two separate full-length diagonal paths after thinning.

Passed on the final implementation: **58 Node tests** and **48 Chrome drawer tests** (all drawer specs, excluding the unrelated guesser suite). These include real local line/subject models, native CDP execution and Stop/Escape, palette verification, previews, crops, selection editing, preferences, blueprint processing and 24-color handling. Existing line-drawing and product-photo previews were also visually inspected. Packaging passed syntax and manifest-reference checks; all 20 ZIP entries match the workspace, with version 2.2.19.

Reload the extension and refresh Skribbl, or hard-refresh the local viewer. No model/service restart is needed. Package using `npm run package` for `dist/skribbl-auto-guesser-2.2.19.zip`; weights and the Python service remain outside the ZIP.
