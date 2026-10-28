# Pencil planning for wide and narrow ink — 2.3.3

Nearly uniform-width ink can use the game's 4, 10, 20, 32 or 40-pixel pencil along center paths instead of tracing a closed contour and changing to Fill. The original 2.3.0 rule excluded widths below 7px and regions with more than 12 traced paths. That missed the supplied cartoon's connected 4–6px lines and generated over a thousand tiny bucket compartments.

The 2.3.3 release includes the 2.3.1 preview changes: it pairs boundaries across local normals and compares their smoothed tangent directions. At least 90% of sampled pairs must agree with a cosine of at least 0.9 for the parallel-ink route. It handles up to 128 traced paths, smooths raster stair steps, and constrains pencil centers to the permitted footprint. Small offset passes or short corrections accommodate widths between game pencil sizes; duplicate passes that add no source coverage are removed.

Black pencil regions are drawn after other fills, and their redundant thin black edge traces are omitted. Multiple paths belonging to one optimized region stay atomic under budgeting. Preview rendering, cached playback, exported JSON and execution share the same stroke-part representation.

## Safeguards

- The original exact-footprint route retains at least 93% source coverage, at most 4% painted spill and at least 90% intersection-over-union.
- For parallel narrow ink, at least 90% is covered, with at most 2% of the source farther than one pixel from paint. The 4px pencil's validation footprint reserves a quarter-pixel antialias fringe instead of counting both hard raster edges as fully black. Any painted spill is confined to one pixel of the source. Completely filled interior holes are rejected. Pixels clipped by the actual canvas boundary are handled separately.
- Broad interiors are rejected before iterative thinning. Filled blobs, unsupported widths and strongly varying thickness keep the sealed-region/bucket approach.
- Curved loops and separate nearby lines are checked without filling their hole/gap. The optimization does not bridge disconnected regions.
- Only the game's available pencil widths are used. Matching parallel ink prefers pencils; other exact-fit candidates are compared with the fallback cost, including actual bucket compartments. No new manual setting is required: process again to obtain the new plan.

## Checks

`tests/thick-lines.test.cjs` covers horizontal/diagonal 10/20/32/40-pixel strokes, 4–5px curves, connected 5–6px branch groups, clipped ends, small holes, a curved ring, a neighboring line, a filled circle, a tapered shape, JSON round trips, budgeting and redundant edge removal. The straight black sample becomes one wide pencil drag with zero bucket operations. The narrow branch groups use pencils without bucket operations.

The trusted-CDP executor fixture in `tests/executor.spec.cjs` processes a 40-pixel line, selects the real fixture's 40-pixel pencil, sends trusted input, verifies no Fill selection, checks interior/exterior pixels and confirms detach. Existing cached-preview, colors, workflow and studio checks exercise the shared renderer and planner.

These are fixture-based correctness and operation-count checks, not a measured live-room speed guarantee. A line whose shape cannot be represented safely by the available pencil widths retains its bucket plan.

## Supplied-plan reproduction

The supplied JSON records **1,038 bucket clicks**. It does not contain original image pixels, so its color-region contours were filled with the even-odd rule to reconstruct a private black/white test image. Processing the same reconstruction with the 2.3.0 engine produced **790 bucket clicks / 3,919 input events**; the updated engine produced **11 / 2,850**. The difference from the original plan is due to contour reconstruction and rasterization. These are plan counts, not live drawing timings.

Real Canvas rendering retains **94.1%** of source black pixels, compared with **93.0%** before. Black-pixel intersection-over-union improves from **48.5% to 78.2%**, primarily because redundant exterior tracing is removed. No fills or outlines were omitted by the time budget in this reproduction. The before/after images were visually inspected; an earlier candidate that left thin spots and dotted corrections was rejected before packaging.

Current checks: **85 Node tests** and **six browser preview/playback checks**, including narrow-source pixel coverage, cached forward/rewind equality and preserved holes. The trusted-CDP executor and cancellation checks also passed during this change.

The user JSON, reconstructed artwork and its preview remain in ignored local artifacts; they are not added to the repository. Published regression fixtures are generated curves and branches. The existing 2.3.0 release remains unchanged; this fix is packaged separately as a 2.3.1 local preview.

Preview evidence: [wide-pencil result](../screenshots/validation-2.3.0/wide-pencil-preview.png) and [metrics](../screenshots/validation-2.3.0/wide-pencil-metrics.json). Three sample strokes use widths 20/32/40 with zero bucket clicks; cached playback matches the reference at forward and rewind positions.
