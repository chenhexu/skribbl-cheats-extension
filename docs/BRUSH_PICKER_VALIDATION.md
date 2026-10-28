# Brush-picker startup fix — 2.2.10

The reported error was `Game brush controls not found. Cannot reproduce the planned brush width.` The previous code only opened the size menu if size elements already existed but were hidden, sent a coordinate click to its preview, and immediately reused the original element list. An intercepted click or delayed initialization led to a false missing-controls error.

Checked the current public [game script](https://skribbl.io/js/game.js) and [toolbar stylesheet](https://skribbl.io/css/style.css). The five widths are 4, 10, 20, 32 and 40. The preview toggles `.sizes .container.open` on click; a size click updates `.selected` and closes the menu. The game uses pointer-down handlers for palette colors, so those retain trusted CDP input. Legacy drawer modes are unchanged.

## Change

- Open the native size picker through its own click handler, avoiding coordinate interception by floating UI.
- Re-query the native choices after opening and allow up to one second for initialization. Check cancellation and the drawing turn between 25 ms waits. Ready controls incur no fixed wait.
- Select the actual size control and verify `.selected` before caching the width or sending a canvas stroke. A visible control can receive a trusted-click fallback; a rejected or unavailable size fails explicitly.
- Close an open size menu before palette input, and on Stop/completion/failure. A regression run caught a leftover open menu selecting width 40 instead of the intended palette swatch on restart; this cleanup prevents that interception.
- Keep the existing mouse-release, debugger-detach, run-ID and turn guards. Neither AI models nor processing paths change.

## Validation

```powershell
npm test
$env:SAG_TEST_PORT='8766'
node node_modules/@playwright/test/cli.js test tests/drawing-turn.spec.cjs tests/executor.spec.cjs
npm run package
```

The Chrome fixture uses the game's menu class/selection behavior and real trusted CDP input. It exercises a covered preview, initially absent choices, changing 40 → 4, Stop while initializing, a later clean restart, a menu that never becomes ready, a rejected selection and loss of the drawing turn while waiting. The initial interrupted run must send no canvas input; late picker initialization cannot resume it. The successful first-round canvas was inspected visually.

Final results: **43 Node tests and all 8 targeted Chrome tests passed**. Packaging passed JavaScript syntax/manifest-reference checks; the ZIP was checked for version 2.2.10, the updated picker implementation and the corrected viewer badge.

The existing native executor checks cover continuous curves, safe bucket fills/holes, verified Fill/Brush switching, required blueprint bases, focused foreground ordering, CSS-scaled canvases and cancellation. No live multiplayer room was joined; the exact cause on the user's first round cannot be observed from the screenshot alone. The reproduced menu failures cover the fragile startup path identified by its error.

Reload the extension at `chrome://extensions`, refresh Skribbl, then upload/process and start on your drawing turn. The Python service needs no restart. The explicit packaging command writes `dist/skribbl-auto-guesser-2.2.10.zip`; no store publication was performed.
