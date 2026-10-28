# Panel resizing and viewport edges — 2.3.3

The floating Auto-Drawer now has eight resize handles: north, south, east, west and all four corners. The six-pixel top resize strip is separate from the draggable header below it. Both panels use zero-margin viewport bounds, and floating dimensions use border-box sizing so borders do not add hidden pixels to saved sizes.

Resize calculations preserve the opposite edge and stop at the available viewport boundary. The drawer can grow to the same 1400-pixel width limit as the guesser, rather than the old 520-pixel limit. The 85% drawer and 90% guesser CSS height caps no longer conflict with resize calculations. Both use the available viewport height, up to the existing 1200-pixel size limit. Saved positions and window-shrink clamping also use zero margins.

`tests/panel-layout.spec.cjs` exercises real mouse drags in isolated Chrome pages:

- All eight floating handles change the intended dimension, keep the opposite edge fixed, and save the actual size.
- Both panels reach the top/left edges by dragging, and the bottom/right edges by dragging or resizing, with no forced gap.
- Panels sized at 1200 × 900 remain reachable after the viewport shrinks to 390 × 500. The guesser also restores within the smaller viewport on reload.
- Header dragging still undocks/redocks the drawer; resize handles do not invoke that gesture.

These two browser checks pass along with 30 existing drawing-preview, guessing and search UI checks. Three Python-model-specific UI cases are skipped by the static fixture; real Chrome-model tests run separately against the packaged extension. All 93 Node checks also pass.

Evidence: [all-edge resize](../screenshots/validation-2.3.3/all-edge-resize.png), [window edge bounds](../screenshots/validation-2.3.3/panels-at-window-edges.png). Tests use synthetic game markup, not a live room or the user's browser profile.
