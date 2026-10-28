# Drawing Stop validation — 2.2.14

## Change

The Colors + outlines panel previously called Stop without returning/awaiting the background cancellation promise and immediately reported Stopped. The canvas may receive user pointer events during a held stroke, bypassing the button's normal click handler. There was also a startup race: Stop during the first awaited cleanup could miss a run that had not yet been registered.

Stop now recognizes pointer input at its visible coordinates in document capture phase, including events targeted at the canvas. It cancels on press instead of depending on a later click. Start remains disabled while release/detach is pending, and cleanup errors appear explicitly. Escape cancels from the drawer executor even when panel controls are not focused.

Every new plan start checks a request generation after its initial await. The worker remembers canceled run IDs, so a delayed begin cannot reopen them. Active mouse-command waits are interruptible; a pending press is considered held before its acknowledgement, ensuring cleanup sends a release even if that acknowledgement is delayed. Commands time out after three seconds. Failed input invalidates the session, so already queued work cannot keep drawing. The existing 12 ms held-move pacing remains in place; cancellation does not flood extra moves to finish a curve.

Stop releases at the last planned input position and detaches the debugger. It does not modify the game's socket connection or send room-leave, clear or undo commands. Already delivered drawing packets cannot be retracted.

## Checks

Passed: **51 Node tests** and **16 targeted Chrome tests** (drawing-turn, executor and palette suites). After the final UI promise-handling adjustment, the three directly affected Stop/Escape/processing-cancel Chrome tests were rerun and passed. Packaging performs JavaScript syntax and manifest-reference checks as well.

- Node transport tests: interrupt a delayed press and a delayed move without waiting for the original callback; release before detach; late callbacks send no additional input; timeout; cancel-before-begin; quick restart; failure; external detach; ordinary curves and bucket clicks.
- Chrome fixture: start a 10,000-point curve using trusted CDP input, click the real panel Stop button while moves are arriving, observe Stopping drawing with Start disabled, then Stopped. Assert cleanup finishes within 1.5 seconds on this local fixture, input ends with a zero-button release, commands cease, and restart completes.
- A separate retargeted pointer event checks the capture-phase coordinate route. This part simulates the captured target; the real-click test does not depend on native pointer capture remaining active across CDP commands.
- Escape cancels a held curve; Stop immediately after starting cancels before any canvas input. Restart works afterwards.
- Existing drawing-turn, delayed first-round brush picker, palette color verification, native bucket and curve execution, scaled canvas and processing Stop checks remain covered.

Screenshot: [acknowledged Stop](../screenshots/validation-2.2.14/stop-acknowledged.png), visually inspected. Its plan is a synthetic long-curve fixture, not an uploaded photograph or a live room.

Validation uses a local game fixture and actual headless Chrome/CDP. No public/private room was joined, so the reported server-ping spike/kick has not been reproduced or proven fixed. The change prevents further extension drawing input after cancellation; it cannot discard a server's existing network backlog.

## Load/package

Reload the standalone extension in `chrome://extensions`, then refresh the game tab. Press Stop, or Escape with the game tab focused. The Python service does not need restarting.

Run `npm test` for Node checks and `npm run test:ui` for Chrome fixtures. For an alternate temporary viewer port, set `$env:SAG_TEST_PORT='8766'` first. Package with `npm run package`; output is `dist/skribbl-auto-guesser-2.2.14.zip` plus the SHA256 manifest. This does not publish to the store.
