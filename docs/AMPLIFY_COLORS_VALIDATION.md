# Amplify colors — 2.2.21

The user's night image contains a dark navy sky that the nearest-game-color mapping can collapse into black. Increasing Color count alone does not solve a collision onto the same swatch.

**Amplify colors** is an optional toggle in the sticky workflow. It starts at strength 70 and reveals a 0–100 slider. Zero is off. Adjusting it enters manual mode, preserves other processing values, invalidates the old plan and requires Process image before drawing. Reapplying Auto retains this user-owned choice. Strength is saved using the existing per-field preference mechanism, with Chrome storage shared between extension surfaces and separate localStorage for the standalone viewer. Explicit image-session settings override saved defaults.

## Processing

The shared engine accepts bounded `settings.amplify`, defaulting to zero. At zero, color-analysis and palette-mapping behavior remain unchanged. With amplification enabled, smoothed color samples receive a modest shadow-weighted LAB lightness/chroma lift before representative-color merging. Palette selection places greater weight on preserving lightness and penalizes throwing meaningful source chroma away into a neutral swatch. Truly neutral samples are restricted to neutral game colors, preventing green/blue casts caused by a closer lightness match. The darkest shadows can stay black; highlights receive little lift. Warm shadows remain warm rather than receiving a generic blue tint.

The image buffer is not modified. Original preview, crop alignment, alpha, subject model, line model and source edge gradients retain their original input. Amplified region labels may expose additional color boundaries for the final outline alignment. Light-lines treatment uses the same amplification/mapping for its base color while preserving white ink. Subject and background layers receive the same strength; their existing simplification and timing policies still apply.

This is deterministic browser color processing, not a model call. It cannot reconstruct color absent from the source or add game-palette swatches. Merge strength, Color count and drawing budgets can still remove distinctions. Use three or more colors to retain a blue sky, black foreground and light moon together.

## Reproduction and visual checks

The controlled [night fixture](../tests/fixtures/night.svg) has a navy sky, dark clouds, black trees/hills and a pale moon. It is a representative fixture, not a copy of the user's uploaded photo. The test uses the same crop/aspect pipeline and rendering as the panel.

| Source region | Amplify off | Strength 70 |
| --- | --- | --- |
| Navy `(24,39,73)` | Black `(0,0,0)` | Dark blue `(14,8,101)` |
| Deep shadow `(2,5,7)` | Black | Black |
| Pale neutral moon | Light neutral | Light neutral |

Both [before](../screenshots/validation-2.2.21/night-before.png) and [after](../screenshots/validation-2.2.21/night-after.png) show Final drawing, rendered from actual strokes. The [exported PNG](../screenshots/validation-2.2.21/night-export.png), [expanded controls](../screenshots/validation-2.2.21/amplify-controls.png) and [compact controls](../screenshots/validation-2.2.21/amplify-compact.png) were visually inspected. The saved plan includes amplification strength, and the sky has an actual dark-blue fill operation.

Node checks cover night/neutral separation, unchanged source pixels/alpha, white and black inputs, grayscale gradients, warm shadows, bounded colors/strength, deterministic results, Auto preserving the choice and light-lines white ink. Browser checks cover before/after pixels and fills, Original staying unchanged, toggle/manual handoff, stale drawing, PNG/JSON exports, strength adjustments, reload, extension storage sharing, session precedence, compact/large plan equality and the same plan reaching the drawing callback.

Passed: **62 Node tests** and **30 distinct targeted Chrome tests** across amplification, preferences, workflow layout, blueprints, color-count stability, scenery, crop/playback, subject models and selection editing. The new drawing handoff check uses a callback fixture; it does not claim a new live-room benchmark. Packaging checks JavaScript syntax and manifest references. The ZIP's version and every packaged file were verified against the workspace.

Reload the extension and refresh Skribbl, or hard-refresh the local viewer. No Python/model restart is needed. Package with `npm run package`, producing `dist/skribbl-auto-guesser-2.2.21.zip` and its SHA256 manifest.
