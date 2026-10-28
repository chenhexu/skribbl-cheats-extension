# Verified drawing colors — 2.2.13

The reported mailman preview had a skin-colored face and brown bag, while the game rendered those regions blue. The prior executor sent palette coordinate clicks, then cached the requested color without checking whether the game selected it. A covered swatch could leave the previous blue active for both its enclosing stroke and bucket fill.

## Reproduction

A trusted Chrome CDP fixture uses the native two-row 26-color palette arrangement, primary/secondary SVG indicators, Brush/Fill state, 90 Hz move throttling and the shared 4-connected bucket behavior. A floating panel covers only the skin and brown columns, leaving blue and black clickable. A small mailman plan paints a blue uniform/cap, skin face and brown bag, then black outlines.

The reproduction was run before changing the executor. It failed with both face and bag pixels equal to **[0,178,255]**, the previous uniform blue. The same plan's preview expects face **[255,172,142]** and bag **[160,82,45]**. The corrected executor produces those intended colors while the swatches remain covered.

- [Before: blue face/bag](../screenshots/validation-2.2.13/mailman-before.png)
- [After: intended skin/brown](../screenshots/validation-2.2.13/mailman-after.png)

These are a synthetic regression scene, not the original uploaded illustration or a live multiplayer room. The exact obstruction in the user's session cannot be proved from the screenshot; the test reproduces its distinctive preview/game mismatch.

## Change

Checked the current [public game client](https://skribbl.io/js/game.js): palette swatches select on pointerdown, left-button input updates the primary color, alternate/right input updates the secondary color, and the selected primary updates `#color-preview-primary` plus the mobile color preview.

The executor addresses the swatch itself with explicit primary/left pointer events, then reads the actual SVG/mobile preview before proceeding. Unchanged requested color IDs no longer justify assuming the current color; every contour/path and bucket checks it again. A changed color between sealing and bucket input is restored. Canvas input remains real trusted CDP input with the existing held-button and pacing rules.

If direct palette handling is rejected, a trusted fallback is allowed only when hit testing confirms the swatch is at the target coordinate. It never clicks an intervening panel or canvas. A missing color indicator or unsuccessful selection stops before canvas input, releases pressed input if any, and detaches. Legacy drawing modes remain separate.

## Validation

```powershell
npm test
$env:SAG_TEST_PORT='8766'
node node_modules/@playwright/test/cli.js test tests/palette-execution.spec.cjs tests/drawing-turn.spec.cjs tests/executor.spec.cjs
npm run package
```

Six palette checks cover blocked skin/brown swatches, correct primary versus secondary input, failed selection without wrong-color painting, trusted fallback, mobile palette readiness/feedback, color changes between contour and bucket, covered fallback rejection without clicking the panel, and missing color feedback. Existing fixtures now include actual primary-color feedback rather than allowing unverifiable clicks. The native executor and drawing-turn suites also cover first-round picker setup, Stop/restart, turn loss, safe bucket holes, required blueprint backgrounds, focus ordering and scaled canvases.

Final results: **47 Node tests and all 14 targeted Chrome tests passed**. Before/after execution images were inspected visually. Packaging passed syntax and manifest-reference checks and produced version 2.2.13.

Reload the extension at `chrome://extensions`, refresh Skribbl and process/upload as usual. Package with `npm run package` into `dist/skribbl-auto-guesser-2.2.13.zip`. No model/service reinstall or store publication is involved.
