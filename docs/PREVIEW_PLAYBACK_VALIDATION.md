# Path playback — 2.2.16

## Cause and fix

The old preview cleared its canvas, replayed all preceding contours and bucket fills, then drew all arrows/travel on every animation frame. Later frames repeated progressively more work, including full-canvas readbacks and flood fills. Its progress clock also rounded through the integer range control every frame, producing different playback speeds at different refresh rates and large catch-up steps after stalls.

`createPlanRenderer` flattens the same ordered stroke parts once, then retains completed strokes on a clean canvas. Only newly completed parts and the current partial stroke need painting. Partial curves use a native Path2D that grows with the revealed points; they are committed to the clean canvas in one complete stroke to preserve joins and avoid repeated antialiasing buildup. The original stateless renderer remains the reference and PNG-export renderer.

Annotations have a separate transparent surface. They never enter a future bucket's pixel input. Options changes rebuild annotations without replaying fills. Changed skipped work invalidates affected prefixes; backward seeking restores a valid checkpoint or rebuilds from the start. Storage is bounded to two working canvases and at most six checkpoints. All surfaces are disposed when a plan is invalidated, replaced or its UI destroyed.

The playback clock retains fractional progress independently of the range control. Elapsed steps are capped at 50 ms, so returning from a background/stalled frame advances gently instead of catching up in one jump. Leaving Drawing path pauses playback. The in-game plan, event order and drawing execution are consumed as before.

## Validation

Chrome checks compare reference and cached images at forward/backward positions, full completion, option changes and changed skipped strokes. Drawing pixels without annotations match byte for byte, including the enclosed hole. Compositing a transparent annotation cache can differ by up to four RGB levels at antialiased overlaps; no geometry/bucket changes are allowed. The real UI is also played, paused and switched to Original. A controlled animation clock verifies equal progress at 60/120 Hz and bounded catch-up after a one-second stall.

Passed across focused runs: **51 Node tests** and **17 targeted Chrome tests**, including the four new playback checks plus existing preference, Stop/Escape, Auto/manual, crop/session, subject-first and blueprint checks. The final isolated playback run passed all four checks. Packaging additionally checks JavaScript syntax and manifest references.

The stress plan contains 150 bucket regions, one enclosed hole and 500 continuous outline paths. Across 12 late-prefix render calls in headless Chrome:

| Measurement | Result |
| --- | ---: |
| Original stateless median | 257.5 ms |
| Cached median | 1.8 ms |
| Previously completed bucket readbacks in those frames | 0 |
| Retained canvases, including test output | 8 |
| Actual UI renderer 95th percentile, after warmup | 0.8 ms |

These measure synchronous rendering calls on this computer, not a guaranteed device frame rate. First-time processing/filling, very long paths and large seeks can still take time. The comparison uses the unchanged stateless renderer with the identical plan, options and dimensions; it is not a faster approximate drawing.

Artifacts: [render timings](../screenshots/validation-2.2.16/preview-timing.json), [UI timings](../screenshots/validation-2.2.16/ui-frame-times.json), [late path](../screenshots/validation-2.2.16/late-path.png), [final with hole](../screenshots/validation-2.2.16/cached-final.png). Both images were visually inspected.

## Loading

Reload the extension at `chrome://extensions`, then refresh the game. Hard-refresh the local viewer to load the updated scripts. The Python service does not need restarting. Run `npm run package` for `dist/skribbl-auto-guesser-2.2.16.zip` and its SHA256 manifest.
