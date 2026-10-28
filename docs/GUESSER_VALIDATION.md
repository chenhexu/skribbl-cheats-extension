# Guesser 2.2.4 local preview validation

Validated October 25, 2026 for chat-confirmed submissions and spam rejection.

- 34 Node tests and 16 distinct Chrome tests pass. The full 15-test Chrome suite passed, then all six guesser tests passed after adding the spam-recovery Stop test. Existing drawing, local AI, crop, Auto settings, and transport tests remain passing.
- The guesser fixture uses the public client's chat DOM structure: individual `p` rows containing `b` author/system text and a `span` message. It handles form submission with both a form and submit button present. A single attempt produces one submission. No live room was joined or sent test guesses.
- The automatic queue waits for a fresh exact own-player echo before advancing. Another player's identical word, and player-authored text saying “Spam detected”, cannot confirm or reject the pending submission. Last guess remains the last confirmed word.
- A real system spam warning rejects the pending send, retains the word, applies the existing cooldown, and retries the same word first. A second strike pauses automation. Explicit Stop cancels recovery; Start can retry the retained word.
- Manual multiword guesses, dot-prefixed close hits, rejected plain-word resends, and own-player success messages use the same tracker. A missing acknowledgement times out without marking the word as delivered. Stop clears its timer; a new round clears pending and retry state.
- Chat pruning, equal-length replacements, cloned history, late echoes, and transitions arriving in the same mutation batch are covered. Rows are processed in order so a new-round signal invalidates an earlier round's outstanding acknowledgement.
- The compact panel was visually inspected in both spam-cooldown and confirmed/pending states. Screenshots are generated under ignored `test-results/`. Status text distinguishes submission, confirmation, cooldown, and retained retries.

This confirms acceptance as reflected in the game's chat/system DOM, rather than assuming synthetic input dispatch succeeded. It does not introduce a socket protocol acknowledgement or remove the existing server spam limits.

Run `npm test`, `npm run test:ui`, and `npm run package` from the extension folder. The package allowlist and manifest include `guess-delivery.js`; packaging validates JavaScript syntax and manifest file references. Reload the unpacked extension and refresh the game tab to activate 2.2.4. Store publication remains separate.
