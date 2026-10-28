# Drawing-turn detection 2.2.8

Validated October 25, 2026 after a report that an active drawing toolbar was rejected as another player's turn.

The [public client](https://skribbl.io/js/game.js) retains the previous `.reveal.show` in `.overlay-content` when the next drawing phase begins. It animates that content to top -100% and removes `.show` from the separate `.overlay` background. The old extension only checked the reveal element's nonzero dimensions, so the off-canvas reveal could reject later valid turns.

The guard now uses the native background overlay's active state and whether it is visibly overlapping the canvas. Retained reveal dimensions do not block a turn. For older markup without that background element, the reveal fallback checks overlap and hidden ancestors, including display, visibility, and zero opacity. The existing toolbar ownership and drawing-word checks remain; word selection not yet ready and a canvas still covered by a game overlay have explicit start messages. Start checks and the in-flight monitor share the same detection.

## Regression validation

- Three new Chrome tests passed. The fixture retains a positive-size `.reveal.show` after sliding it off the clipped canvas, reproducing the game's behavior. A real trusted CDP stroke starts and finishes on the next own turn, then detaches.
- A visibly active overlay rejects a new plan before sending any input. Empty word selection and another player's toolbar-hidden state also reject before input.
- Showing the overlay while a continuous curve is held aborts the active plan, releases the mouse with buttons=0, and detaches. Hiding it does not automatically resume the old run; an explicit new start succeeds.
- The older-markup fallback accepts an off-canvas reveal or one hidden by ancestor opacity, visibility, or display, while rejecting a visible reveal over the canvas.
- Seven transport unit tests passed, covering held-button state, Stop, quick restart, command failure, and debugger detach. The existing executor suite was also run for normal drawing, bucket tool selection, required blueprint backgrounds, CSS-scaled canvases, lost turns, and compact processing cancellation.

These checks use a local game DOM fixture and the installed Chrome debugger transport. No live room was joined. The processing engine, guesser logic, and line-art model are unchanged. Reload the extension and refresh the Skribbl tab to activate the guard; package with npm run package into dist/skribbl-auto-guesser-2.2.8.zip. No store update was published.
