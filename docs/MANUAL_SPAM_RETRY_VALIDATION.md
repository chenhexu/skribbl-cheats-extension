# Manual guesses after spam — 2.2.12

The shared send guard checked `spamDetectedCount >= 2` for both automation and manual actions. The strike counter only reset on a later recovery callback or Start; Stop canceled that callback. This could leave manual clicks blocked after the actual timestamp-based cooldown expired. The countdown was driven partly by automation ticks, so it also stayed stale when stopped. Stopping automation replaced the candidate list with a placeholder, removing the manual buttons.

## Change

- Candidate clicks, search Enter and number shortcuts explicitly request manual sending. They honor the live `spamBlockedUntil` deadline without inheriting the automation-only repeated-strike lock or automatic retry cap.
- A separate cancellable countdown updates the UI while automation is stopped. The existing waits remain 4, 8 and then up to 12 seconds. Early clicks show the remaining wait and do not schedule a manual send for later.
- Stop still disarms automation and cancels its recovery timer; candidates stay available for manual use, retaining the current search filter. Starting a new round cancels the countdown and clears cooldown state.
- A pending chat confirmation still blocks another submission. Spam rejects the attempt without adding it to sent words. Retries require actual chat/system confirmation before Last guess and sent words update.
- The automation guard, retry cap and repeated-spam recovery policy stay separate. Recovery cannot erase a newer deadline from an intervening unconfirmed manual attempt or replace its pending confirmation status. Exponential backoff is bounded before exponentiation, avoiding bit-shift overflow during repeated manual warnings.

## Validation

```powershell
npm test
$env:SAG_TEST_PORT='8766'
node node_modules/@playwright/test/cli.js test tests/guesser.spec.cjs
npm run package
```

Chrome uses the existing chat/form fixture and controlled clocks to test elapsed deadlines rather than waiting in real time. New cases cover:

- First rejection: a click at three seconds remains blocked with 1s shown; at zero it submits once. Another click while confirmation is pending sends nothing.
- Repeated warnings plus Stop: the strike count remains two, auto-recovery is canceled, the filtered candidate stays visible, and a manual click submits after the eight-second deadline without Start. Confirming it never restarts automation.
- Search Enter and number shortcuts after repeated warnings, including the capped 12-second backoff.
- Five unconfirmed attempts reaching the automation retry cap, followed by a successful explicit manual attempt.
- An old recovery timer firing while a newer unconfirmed-attempt cooldown is active: the newer deadline still blocks input until it expires.

The existing automatic retry, dot-prefix close-hit, chat pruning/history, round transition, Stop and acknowledgement tests remain in the targeted suite. Screenshots of manual recovery are saved under `test-results` for visual inspection. Tests do not send guesses to a live multiplayer room or prove a fixed server cooldown; further server spam warnings still reject submissions and extend the local wait.

Final results: **47 Node tests and all 11 targeted Chrome guesser tests passed**. The stopped/manual-retry panel was inspected visually. Packaging passed syntax/manifest-reference checks and produced version 2.2.12.

Reload the extension and refresh the game. Package with `npm run package` into `dist/skribbl-auto-guesser-2.2.12.zip`. No store publication was performed.
