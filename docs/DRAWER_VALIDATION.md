# Auto-drawer 2.2.3 local preview validation

Validated October 25, 2026 for automatic image settings and the manual handoff.

- **26 Node tests and 10 Chrome tests pass.** Added image analysis checks for flat artwork, textured photographs, line art, thin off-grid strokes, transparent letterboxing/ink, blank images, small white features, short drawing targets, determinism, and cancellation.
- Auto is enabled initially and analyzes the cropped, normalized image using sampled RGB variation and perceptual color groups. Existing line/car samples choose line-art (2 colors, detail 72) and photograph (6 colors, merge 24, detail 38) respectively at 60 seconds. It preserves the detector and time target, requests no model or network call, and leaves near-white removal off.
- Editing a slider unchecks Auto, preserves every other suggested value, and invalidates the drawing plan. Re-enabling Auto restores its deterministic recommendation. Merely unchecking Auto also preserves values. Playback scrubbing stays in Auto.
- Crop changes recompute suggestions only while Auto is checked. Auto/manual state, crop and exact settings round-trip into a 320-pixel compact viewer. Legacy sessions without an Auto flag retain their manual settings. JSON plans include the suggestion as optional `plan.auto` metadata.
- A delayed recommendation cannot overwrite a subsequent manual edit. Loading and analysis disable processing so the previous image's plan cannot be started while a replacement is loading. Processing remains an explicit user action.
- An initial recommendation with too few colors absorbed a small white hole into gray in the mountain fixture. Auto now leaves an extra color for small white accents; the white-hole and mountain-preview regression checks pass.

The recommendations are practical starting heuristics, not a global quality search. Existing drawing/execution and AI failure/recovery tests remain in place. Compact/full Auto UI previews and the local sample results were visually inspected. No store update was published.

## Previous 2.2.2 validation

Validated October 25, 2026 after the reported slow drawing, missing bucket fills, and differing previews.

- **21 Node tests and 7 Chrome tests pass.** Added deterministic coverage/color tests with latency 8 ms versus 80 ms, including byte-identical final PNGs and identical paths in compact/expanded viewers. Cancelling during the pointer-rate wait also releases the held mouse button before detach.
- Fill selection uses the actual toolbar click handler and verifies the `selected` class. The CDP test covers a toolbar obscured by an overlay and a handler that refuses to select Fill; the latter stops before any seed click. Brush is restored before outlines. A 720×540 CSS-scaled canvas preserves background and hole pixels while filling the interior.
- The drawing fixture now uses Pointer Events, pointer capture, and the public client's 90 Hz move filter. Removing the waits exposed dropped vertices under this filter; held moves now wait only as needed after the previous command's acknowledgement. Stop/turn-loss tests still release input and detach.
- Fixed 100 ms tool waits and initial hover moves were removed. Subpixel sealing paths and bounded spline fallback polylines reduce redundant commands. A generated mountain plan fell from **1,276 sampled moves in 2.2.1 to 190**, including all 31 drags and 10 bucket clicks.
- On the same small closed-region/hole drawing with identical plan geometry, actual CDP execution measured **1,086 ms with the packaged 2.2.1 executor versus 488 ms with 2.2.2** (about 2.2× faster). This is a local browser fixture, not a private game-room timing guarantee. The optional comparison reads the old ZIP if present and saves `test-results/*/cdp-timing.json`; it is not needed for tests on a clean checkout.
- The 60-second plan uses a fixed planning cost so identical inputs retain identical regions. Saved latency affects only `plan.timing` and displayed duration. Runtime skipping remains explicit and can vary with actual execution speed.

Rechecked the public client for the Brush/Fill click handler, selected-state class, game-pixel flooring, and pointer filtering. Final/path previews and the CSS-scaled executed canvas were visually inspected. No room was joined and no store update was published.

## Previous 2.2.1 validation

Validated October 25, 2026. Closed-region bucket fills are now the default. Version-1 path plans and the previous brush-fill option remain supported.

- **18 Node tests:** includes aligned gap closure without parallel-line bridging, sealed holes/disconnected regions, complete mountain coverage, whole-region budgeting, plus the earlier engine/transport/lifecycle checks.
- **6 Chrome tests:** actual trusted CDP input selects Brush → seals outer and hole contours → selects Fill → clicks a seed → restores Brush for black outlines. Executed coverage matches preview except minor canvas antialias differences at corners (under 0.01% of color channels). Background and hole pixels remain white. Losing the turn after selecting Fill cancels before the bucket click, releases input and detaches. Crop, settings invalidation, playback/exports, compact layout, processing cancellation and explicit AI errors are covered too.
- Both detectors processed the existing line drawing and photograph using the installed CPU checkpoint. Visual inspection included final/path mountain previews and the photograph. The original dinosaur/mountain upload is only present as conversation screenshots, so the reproducible mountain test uses a generated SVG with trees and a white hole.

The mountain fixture with a 300-second target (to retain all brush hatches) produced **31 drags + 9 bucket clicks**, versus **2,076 brush strokes** in the preceding fill mode. Estimated fill cost was **11.2 s vs 76.3 s**; total estimated cost **15.1 s vs 82.6 s**. Processing was 2.4 s vs 2.0 s. These are plan estimates, not measured game-round durations. The biggest improvement came from removing antialias speckles and redundant points on straight boundaries.

Sample bucket-mode run at the default 60-second target; model requests used a warm local service and may hit its cache:

| Image / detector | Processing | AI request | Drags | Bucket clicks | Sampled moves | Color changes | Drawing estimate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Line drawing, Browser | 1.59 s | — | 127 | 14 | 3,682 | 5 | 37.9 s |
| Line drawing, AI | 1.37 s | 0.05 s | 136 | 14 | 3,706 | 5 | 38.3 s |
| Car photograph, Browser | 1.81 s | — | 166 | 51 | 5,562 | 5 | 57.8 s |
| Car photograph, AI | 1.53 s | 0.07 s | 158 | 51 | 5,594 | 5 | 57.9 s |

No color regions were omitted from the line drawing. The photograph omitted 115 whole optional regions and 146 / 287 minor outlines respectively. Budgeting never drops an individual sealing contour or bucket click from a selected region. CDP execution and timing still need confirmation in a real private room after reloading the extension; no room was joined and nothing was published. Test artifacts are under ignored `test-results/`; regenerate with `npm run test:ui`.

## Previous 2.2.0 validation

Validated October 24, 2026. Existing local work and legacy drawing modes were retained. Nothing was published to the Chrome Web Store.

## Checks completed

- **15 Node tests:** connected tracing, off-grid lines, rings/junctions, curve corners, similar/different colors, fill footprints around holes, blank/transparent images, AI alignment, processing cancellation, drag button state, stop/restart, debugger failure/detach, page unload, sender restrictions, and optional local permission.
- **5 Chrome browser tests:** upload/crop/reset, processed/path views, playback/export, stale controls, compact 320-pixel layout, cancelled processing, real checkpoint inference, explicit model failure/recovery, and existing sample images. The executor fixture uses actual CDP input and verifies trusted drag events, popup brush selection, and cancellation on loss of the drawing turn.
- **4 Python service tests:** health/static routes, missing checkpoint, malformed input, local-only host/origin checks, real CPU inference, aspect/dimension alignment, and in-memory caching.
- Extension packaging checks manifest references and JavaScript syntax. ZIP contents use an explicit allowlist and exclude weights, Python service, dependencies, tests, screenshots, and prior archives. SHA256/source metadata accompanies the ZIP.
- Visually inspected final/path previews, the compact UI, and both detection methods on the existing car images.

## Sample comparison

One local run with default 60-second target and CPU-only PyTorch 2.11.0. AI request time below is separate from JS processing. These are observed preprocessing times and **estimated** drawing times, not measured Skribbl round completion times.

| Image / mode | Processing | AI request | Planned strokes | Sampled moves | Color changes | Drawing estimate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Line drawing `lvl1.jpg`, Browser | 0.93 s | — | 483 | 2,782 | 4 | 37.7 s |
| Line drawing `lvl1.jpg`, AI | 0.66 s | 0.34 s | 539 | 1,364 | 4 | 28.0 s |
| Car photograph `lvl2.avif`, Browser | 1.21 s | — | 958 | 3,231 | 6 | 56.3 s |
| Car photograph `lvl2.avif`, AI | 0.78 s | 0.36 s | 1,065 | 2,790 | 6 | 55.8 s |

The legacy Realistic processor took 1.31 s / 0.34 s respectively and produced 1,868 / 14,240 points. Its existing point/chunk estimate returned 0 s / 2 s, which excludes the real debugger workload and cannot be used as a speed baseline. No claim of measured in-game speedup is made.

The photograph reaches the default budget: 1,645 optional fill runs were omitted in each new mode; Browser omitted 53 short outlines, AI 107. Increasing the target or cropping out the background retains more detail. AI can produce fragmented low-resolution lines; the browser alternative remains available for comparison. No nearest-neighbor gap bridging is used to conceal fragments.

## Live compatibility and remaining user test

Read the public game HTML/client to verify the current 26-color palette, five brush widths, popup selectors, and `#game-wrapper.toolbar-hidden` / visible word indicator. The new mode uses those controls; the older modes retain their existing implementation.

The tests do not join a real game room or load the extension into the user's Chrome profile. The next manual check is to reload the unpacked extension, refresh Skribbl, upload an original image, inspect the planned paths, and draw during your own turn in a private room. Confirm alignment, brush/color selection, actual duration, and Stop behavior. The stamp, wagon, and biker originals from the conversation were not available as standalone image files; the existing local samples and a synthetic flat-color illustration were used instead.

The optional local service is ready on this machine, with the author's checksum-verified checkpoint installed outside the extension package. Restart it with `python ai-service/app.py` when needed. Instructions and packaging commands are in the README.
