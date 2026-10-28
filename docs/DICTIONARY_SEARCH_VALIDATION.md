# Saved dictionaries and color relationships — 2.2.26

## Findings

Spotify is already present in `BUNDLED_WORDS`; a seven-letter hint and literal `spo` search should find it. The old loader immediately returned a saved list with more than 3,000 entries, without merging the current bundled bank. Thus an older cache missing Spotify could remain missing indefinitely, even after an extension update. A controlled old cache reproduced the reported **spoiler only** result. The screenshot alone cannot establish the exact contents of the user's cache; this is a reproduced failure path, not a readout from their live browser.

The reported stone failure did not reproduce: both ordinary and Related words modes match redstone through its `stone` substring under `r_____n_`. The user also reported that it started working again. Direct lexical matches already survive low/empty model scores. A regression test now verifies this through the UI before and after an AI response with a weak score.

The color relationship was missing locally, and actual MiniLM scores for redstone were approximately 0.394 for color and 0.401 for colour, near the 0.40 inclusion threshold. The fix adds explicit color-term matching rather than lowering the global threshold or relying on a hosted API.

## Changes

- Cache schema 2 retains `words`, adds `bundleVersion` and `removedWords`, and keeps the same existing localStorage key. Older/release-mismatched caches merge the current bundle, preserve custom entries, apply recorded removals and save the result. A current-version cache keeps its existing bank.
- Remove records a normalized exclusion; Add clears it. Reloads and future bundle merges respect these choices. An old schema had no removal history, so an absent legacy word cannot be distinguished from a deliberately deleted one; the first merge restores missing bundled entries. Existing cached custom words are retained, not reset.
- Controlled test banks declare the current bundle version so legacy guesser tests keep testing their intended dictionaries. Separate tests exercise migration from a real legacy-format cache and from an older release marker.
- A Colors category supports both US/British spellings and plural queries. Indirect matches recognize separate/hyphenated color terms and joined color + known noun heads (stone, berry, board, house, etc.). They get a weaker relevance cue and a reason such as **Contains color term: red**. Direct color names rank higher. Unrelated incidental prefixes, including redemption/prediction, do not gain color-term matches.
- Hint matching, already-guessed exclusions, literal substring search, keyboard delivery, startup preloading and the AI threshold remain unchanged. No query searches outside its eligible bank. The fix works without AI availability and needs no Python restart.

## Validation

22 Chrome checks passed, including all chat-confirmation/spam/search checks, plus:

- Legacy cache with spoiler but no Spotify: `spo` under seven letters returns spoiler + spotify after migration, without fetching external word lists.
- Cached custom word survives migration/reload. Remove Spotify, simulate another release, and reload: it stays removed. Add restores it and the change persists.
- Under `r_____n_`, stone finds redstone in ordinary mode and Related words mode before/after a weak model reply. Color/colour find redstone with the color-term explanation; changing the revealed letter to an incompatible hint excludes it.

Node checks cover equivalent lexical guarantees, model scores that cannot suppress a literal match, direct-versus-indirect color ordering, multiple related compounds, both spellings/plurals and misleading-prefix exclusions. Screenshots for the restored Spotify results and redstone relationship were visually inspected and saved under `screenshots/validation-2.2.26/`.

## Delivery

Load the existing extension folder or extract `dist/skribbl-auto-guesser-2.2.26.zip`, reload it at `chrome://extensions`, then refresh Skribbl. The screenshot's v2.2.24 title indicates an older content script; verify the refreshed title says **v2.2.26**. No settings/custom-word reset is required. Package explicitly with `npm run package`. No publication was performed and the user's service on 8765 was not touched.
