# Imitate pipeline (original) – archived

This folder holds the **original Imitate implementation** from `drawer.js`, put aside so the main codebase can be updated to a line-art / Canny-based pipeline.

- **Source:** Logic that ran when Drawing style = "Imitate" (outline-only, edge detection via `isEdgePixel`, chaining, Bezier smoothing, curve segments).
- **Dependency:** `processImageImitate` uses `nearestColorId(r, g, b, skipWhite)` from the main drawer module (PALETTE + LAB color matching).
- **Restore:** To re-use this implementation, copy the contents of `imitate-original.js` back into `drawer.js` (replacing or merging with the new pipeline as needed).

Do not delete this folder until the new Imitate pipeline is stable and you no longer need the reference.
