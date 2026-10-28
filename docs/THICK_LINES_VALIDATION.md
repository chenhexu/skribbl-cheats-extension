# Wide-pencil planning — 2.3.0

Thick, nearly uniform-width color regions can now use the game's 10, 20, 32 or 40-pixel pencil along a continuous center path, instead of tracing a thin closed contour and changing to Fill. The planner checks the actual round-brush footprint against the simplified source region and only replaces the bucket plan when coverage, spill and estimated input cost pass.

Black pencil regions are drawn after other fills, and their redundant thin black edge traces are omitted. Multiple paths belonging to one optimized region stay atomic under budgeting. Preview rendering, cached playback, exported JSON and execution share the same stroke-part representation.

## Safeguards

- At least 93% of the source region must be covered; less than 4% of painted pixels may spill, with spill confined to one pixel of the source boundary. Intersection-over-union must exceed 90%. These account for raster/center rounding rather than permitting arbitrary shape shortcuts.
- Broad interiors are rejected before iterative thinning. Filled blobs, unsupported widths and strongly varying thickness keep the sealed-region/bucket approach.
- Curved loops and separate nearby lines are checked without filling their hole/gap. The optimization does not bridge disconnected regions.
- Only the game's available pencil widths are used. No new speed control or manual setting is required; process the image again to obtain a new plan.

## Checks

`tests/thick-lines.test.cjs` covers horizontal/diagonal 10/20/32/40-pixel strokes, round caps, a curved ring, a neighboring line, a filled circle, a tapered shape, JSON round trips, budgeting and redundant edge removal. The straight black sample becomes one wide pencil drag with zero bucket operations.

The trusted-CDP executor fixture in `tests/executor.spec.cjs` processes a 40-pixel line, selects the real fixture's 40-pixel pencil, sends trusted input, verifies no Fill selection, checks interior/exterior pixels and confirms detach. Existing cached-preview, colors, workflow and studio checks exercise the shared renderer and planner.

These are fixture-based correctness and operation-count checks, not a measured live-room speed guarantee. A line whose shape cannot be represented safely by the available pencil widths retains its bucket plan.

Preview evidence: [wide-pencil result](../screenshots/validation-2.3.0/wide-pencil-preview.png) and [metrics](../screenshots/validation-2.3.0/wide-pencil-metrics.json). Three sample strokes use widths 20/32/40 with zero bucket clicks; cached playback matches the reference at forward and rewind positions.
