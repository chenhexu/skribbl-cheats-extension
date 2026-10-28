# 2.2.9 subject-first and Fast validation

## Scope and commands

Shared browser processing, optional local foreground AI, preview/session/crop behavior and actual Chrome CDP execution. Existing guess-delivery, Auto/manual, blueprint, bucket, turn-loss and cancellation regressions remain in the suite.

```powershell
npm test
python -m unittest discover -s ai-service -p test_service.py
$env:SAG_TEST_PORT='8766' # isolated test service; production defaults to 8765
npm run test:ui
npm run package
```

Node tests cover masked subject-only/background ordering, brush footprints outside the protected foreground including holes/disconnected areas, deterministic planning, invalid/empty masks, cancellation and fewer Fast speckle operations. Python tests cover both real pretrained models, readiness, missing checkpoints, input validation, original-size grayscale masks and cached inference.

Final check: **43 Node tests, 5 Python tests and all 26 Chrome tests passed**, with no skipped Chrome model checks. The focused footprint test was rerun after adding a hole and detached foreground part and passed. Packaging checked JavaScript syntax and manifest references and produced the 2.2.9 ZIP.

Chrome tests use a synthetic flat jet on a textured runway. They cover manual polygon selection, actual CPU U2NETP inference, green selection inspection, subject-only and subject-before-background plans, protected foreground pixels, partial playback, crop/session alignment and compact layout. Missing AI and interrupted inference leave no usable stale plan; manual selection recovers without silently drawing the full frame.

The executor test sends trusted native CDP drags/clicks through a game-toolbar/canvas fixture with the game's 90 Hz move throttle and 4-connected bucket behavior. It compares full balanced and subject-only Fast execution, verifies the runway remains blank in subject-only, checks late mandatory subject work versus skipped optional background, and verifies input release/detachment. Existing turn/toolbar loss, Fill-selection failure and quick-restart checks remain active. This is not a multiplayer-room benchmark.

## Observed comparison

The final native execution run of the simple silhouette fixture measured **39.76 seconds** for full balanced processing versus **0.835 seconds** for subject-only Fast. Full: 365 drags, 3 bucket clicks, 1,500 moves and 2,233 input events. Subject-only: 2 drags, 1 bucket click, 31 moves and 36 events. The gain mainly comes from omitting runway texture; it is not a universal speed multiplier. The test emits current `subject-speed.json` and execution PNGs under `test-results` on each run.

A more detailed synthetic jet manually marked in the viewer produced 937 drags/6 buckets/4,273 moves for full Balanced versus 83 drags/40 buckets/691 moves for subject-only Fast. Adding simplified background produced 283 drags/40 buckets/891 moves, after the completed foreground. Estimates were 51.2, 7.5 and 12.9 seconds; they are estimates, not measured room drawing durations.

Visual inspection of the AI selection isolated the jet and wheels but missed some gray canopy. Manual marking offers correction before processing. The final and partial previews use actual planned strokes; they must be reviewed after selection. User-supplied originals are not present as workspace files, so no claim is made that this reproduces the exact photographed jet or guarantees correct segmentation of other photos.

## Delivery limits

No store publication, training or remote inference. Foreground weights are installed locally and excluded from packaging. Restart the Python process to enable `/api/subject`; reload the extension and refresh the game for updated code. Full image deliberately retains area/color order. Find or mark the subject to activate foreground priority. Fast trades small detail for fewer operations and keeps the native input pacing limit.
