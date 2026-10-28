# Edit subject parts — 2.2.11

## Behavior

The AI foreground mask can omit useful objects when the background is ambiguous. Edit subject parts keeps that initial mask and supports additive or subtractive corrections instead of requiring a complete replacement polygon.

- Hover connected image regions to preview the candidate. Cyan means Add; red means Remove; green is selected. Hover never commits an edit.
- Click to union/subtract the region. Part grouping changes the LAB similarity threshold, without changing drawing settings or the committed mask.
- Outline (polygon) adds or removes an arbitrary manually drawn area, including places where a color group leaks into the background. Mark subject retains its existing whole-mask replacement behavior.
- Undo stores up to 12 immutable mask snapshots, including previous method/model timing and focus choice. History is local to the mounted viewer and is cleared on a new image or replacement AI/manual mask.
- Finish selecting, then explicitly Process image. A committed edit invalidates the old plan. Auto recalculates from the edited foreground on finishing; manual processing values remain in place. An empty mask disables processing and Crop to subject; it cannot silently become full-frame drawing.

## Implementation

`segmentParts` in the shared browser engine builds full-resolution connected color labels, a compact pixel index and per-region offsets. It performs mild close-shade smoothing without blending across strong contrast, then compares LAB colors against a fixed region seed. Keeping the seed fixed prevents progressive gradient drift across the whole background. Four-connected regions keep enclosed holes and disconnected shapes distinct. Transparent pixels are never selectable. This is local color grouping, not semantic object segmentation or another model call.

Grouping yields and checks cancellation during color preparation and connected traversal. Only the hovered component is visited when constructing its preview, and the base selection overlay is cached. Image replacement, Stop, leaving the editor and manual processing changes invalidate pending work. No external API, permissions, model dependencies or service changes were added.

Edits use normalized source coordinates on the full 800×600 frame. The image and mask retain the same aspect/crop transform. Binary masks use nearest-neighbor crop mapping: the browser's smoothed Canvas and decoded-PNG scaling differed slightly during the initial crop/session test. The corrected mapping gives the same focused area and ordered strokes after PNG session transfer into the compact viewer. The existing DrawingPlan remains the only input to final preview, playback, exports and execution.

## Validation

```powershell
npm test
$env:SAG_TEST_PORT='8766' # isolated test service
npm run test:ui
npm run package
```

Node checks cover disconnected same-color parts, nearby distinct colors, one-pixel lines, transparency, enclosed holes, grouping sensitivity, repeatability, gradient limits, input validation and cancellation.

Four new Chrome tests cover a synthetic dinosaur/mountain scene with an intentionally incomplete AI mask; hover without mutation; adding the mountain while preserving the dinosaur; subtract/Undo; stale-plan invalidation; final stroke-rendered coverage; additive/subtractive polygons; crop alignment; identical compact/expanded plans; 320-pixel editor layout; manual-only transparent images; empty-mask recovery; and delayed grouping canceled by Stop or image replacement.

Final results: **47 Node tests and all 33 Chrome tests passed**, with the installed local models exercised rather than skipped. The full run also retained first-round brush-picker, Stop/restart, real CDP drawing, bucket switching, turn loss, Auto/manual, blueprint, 24-color and guess-delivery checks. Packaging passed syntax and manifest-reference checks; the ZIP was checked for the updated version, editor and grouping engine, with model weights excluded.

The hover, removal, final preview and compact editor are saved as PNGs in `test-results` for visual inspection. The exact originals shown in the user's screenshots are not workspace fixtures. Groups may include background where colors are similar, or require several clicks on textured photos; Part grouping and Outline provide manual control rather than promising object-level grouping. Drawing targets can still omit small details independently of the selection; inspect the finalized plan and its omission counts.

Local reload: refresh the extension at `chrome://extensions`, refresh Skribbl, and hard-refresh an already-open local viewer. Python/model reinstall is unnecessary. The package command writes `dist/skribbl-auto-guesser-2.2.11.zip`. No store publication was performed.
