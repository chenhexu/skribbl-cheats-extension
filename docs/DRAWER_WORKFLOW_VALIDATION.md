# Drawer workflow — 2.2.18

## Behavior

Both the extension panel and expanded viewer use the shared studio UI. Upload and drag-and-drop show a small original thumbnail above the controls. Its raster is at most 160 × 112 pixels and preserves aspect ratio and transparency; the compact display box is 96 × 80 pixels. A temporary image session carries this thumbnail to the expanded viewer so a portrait original stays recognizable after transfer into the 800 × 600 drawing coordinates. It is not saved as a preference.

The large preview defaults to Final drawing and waits for explicit processing. Original and Main subject still display the large image when selected for inspection or editing. The drawing preview, playback and exports continue to use the same DrawingPlan.

The main actions appear in order: Find main subject (AI), Auto settings, Process image, Start drawing. Wide drawing panels use one row, compact panels two rows. The local testing viewer omits Start drawing as before. These actions, Outline detail and Stop stay visible while scrolling. More drawing settings starts folded in compact panels and open in the expanded viewer. Every existing setting remains available.

The Auto settings button reapplies the recommendation even when Auto is already checked. Its adjacent checkbox can disable Auto while retaining suggested values. Editing Outline detail or another processing control switches to manual, invalidates the old plan and disables drawing until reprocessed. The model/permission requirements for Find main subject are unchanged.

## Manual outline detail (updated in 2.2.31)

Auto does not return or apply an Outline detail setting. Image analysis can still identify fine linework for its explanation, while the user's chosen slider value survives new uploads, crops, Reset crop and re-enabling Auto. Drawing targets change the suggested color/merging settings, without changing outline detail. Light-on-dark drawings retain their dedicated treatment.

This is a deterministic browser heuristic. It does not recognize the meaning of an object or guarantee that every fine feature survives the game brush and drawing budget. Outline detail remains immediately accessible for adjustment.

## Validation

Chrome workflow checks cover portrait upload, landscape drag-and-drop, thumbnail aspect/bounds and session transfer, default Final drawing placeholder, compact action order, sticky controls, no horizontal overflow, Find subject → Auto → Process → Draw, and manual Outline detail invalidating a plan. The workflow model and drawing callbacks are mocked in that layout test; separate integration tests exercise the real local models and native CDP drawing.

The regression fixture contains a dark thin rectangle and a separate weak gray line. A manually chosen detail of 96 retains more weak-line pixels than 72. Auto is checked across several drawing targets and requested detail values to verify that detail is absent from every recommendation. Browser checks retain chosen values through uploads, cropping, manual/Auto transitions and expanded/compact session transfer.

Passed: **56 Node tests** and **45 Chrome drawer tests** (all drawer specs, excluding the unrelated guesser suite). This includes real local line/subject inference, native CDP drags, relocated Stop/Escape, palette verification, narrow-panel layout, cached playback, cropping and selection editing. Packaging passed JavaScript syntax and manifest-reference checks; the ZIP's version and current UI/engine bytes were verified.

Visually inspected artifacts: [compact controls](../screenshots/validation-2.2.18/compact-workflow.png), [controls while scrolling](../screenshots/validation-2.2.18/sticky-workflow.png), and [uploaded thumbnail](../screenshots/validation-2.2.18/upload-thumbnail.png). The user's worker illustration was supplied as a screenshot rather than a source image; quality checks use the repository's precision fixture and existing image regressions.

Reload the extension at `chrome://extensions` and refresh Skribbl. Hard-refresh the local viewer with Ctrl+Shift+R; the Python service needs no restart. Run `npm run package` to create `dist/skribbl-auto-guesser-2.2.18.zip` and its SHA256 manifest. Store publication is outside this change.
