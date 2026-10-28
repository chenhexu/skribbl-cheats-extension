# Related-word search — 2.2.24

Historical first release. Version 2.2.25 moves model loading/public dictionary encoding to background startup and persists only public dictionary embeddings. See [current preload behavior and validation](SEARCH_PRELOAD_VALIDATION.md); the original cold-first-query measurements below are retained for comparison.

Implemented in the standalone extension. No hosted API, MiniMax token, model training, hints-site edits or store publication.

## Behavior and interfaces

- Existing length/revealed-letter/word-spacing filters run first. Search uses the complete resulting candidate bank; automation still considers only its first 1,200 entries, in its existing order. Already-guessed words remain excluded. Pending guesses remain visible but disabled until confirmation/rejection.
- Related words defaults off. Closest first defaults on; turning it off alphabetizes the same result set. Both are stored with existing guesser preferences. Empty queries keep the ordinary list. Ordinary mode preserves substring filtering.
- Browser matching covers exact, singular/plural, prefix/substring, edit similarity and human-authored categories. Matching is on whole category terms, never incidental substrings such as cat in cathedral. Specific shared families take precedence over broad ones: fish relates to marine life rather than every animal/food.
- Exact/plural matches rank first; direct categories precede spelling lookalikes, followed by prefix/substring, broader category and model matches. Strong spelling uses `1 - Levenshtein distance / max(lengths) >= 0.8`. General AI eligibility starts at cosine 0.40; an explicit category query requires 0.55 for a word known only in other categories, suppressing examples such as food → chair. These are relevance heuristics, not answer probabilities. Weak associations can still occur.
- Color cues use a green-to-red border/tint, with a textual tooltip/accessible label explaining the winning match. A computed-style assertion catches the panel's global `!important` button styles overriding these indicators. On hover/mouseleave the indicator remains intact.
- Every input immediately computes local matches. Only semantic inference waits for a 200 ms typing pause. The controller cancels superseded HTTP requests, guards query/bank/round generations, and caches 32 result sets. Keyboard selection recomputes/synchronizes visible order and checks current eligibility before submission. Candidate clicks recheck the current query and eligible bank.
- New shared `word-search.js` loads before the guesser. The background `aiWordSearch` message accepts `{id, query, candidates}` and forwards only to the fixed loopback `/api/word-search` endpoint after optional host permission. Existing `aiCancel` cancels requests, including before an awaited permission check resolves. Search timeout is 30 seconds to allow cold model loading; it never blocks typing or local matching.
- `POST /api/word-search` accepts `{query, candidates}` and returns `{matches:[{word, score}], model, processingMs, encodedWords}`. Query/candidate words are limited to 128 characters; the service accepts at most 20,000 supplied candidates and never searches a separate database. The panel intersects responses with its eligible bank again. Invalid input returns 400; missing dependencies/model or a busy model returns 503; inference errors return an explicit 500 response.
- `GET /health` adds independent `wordSearch` information: model/revision, installed, ready, lazy, device and error. Loading is lazy and local-only. Image-model readiness does not gate word search. Model and image inference use separate locks. Candidate/query embeddings stay in memory, capped at 20,000/128 entries. The service does not log request bodies or persist search text/results.

Model: [sentence-transformers/all-MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2), revision `1110a243fdf4706b3f48f1d95db1a4f5529b4d41`. The model is a trained embedding network, distinct from the curated browser category rules. See the [upstream semantic search documentation](https://www.sbert.net/examples/sentence_transformer/applications/semantic-search/README.html). The pinned download retains the upstream model card and Apache-2.0 license beside the weights, excluded from the extension ZIP.

## Validation

Automated checks cover food/marine relationships, plurals, partial words, 80% spelling, category specificity, alphabetical equivalence, response membership validation, debouncing, cancellation, late responses, caching and model failures. Chrome checks exercise actual input, hint changes (`_____` → `___t_`), all three selection methods, preference restoration, missing loopback access, more than 1,200 candidates and real local-model output. Existing chat-confirmation/spam tests and drawer workflow/subject-processing tests pass.

Real dictionary examples visually inspected:

- **fish, seven letters:** catfish, dogfish, dolphin, lobster, octopus and seaweed appear within eligible results. No incompatible lengths enter the list.
- **food, five letters:** apple, bacon, bagel, beans, bread and other foods receive direct-category indicators. Spelling lookalikes can remain as lower-ranked green spelling matches; they do not precede direct food matches.
- **music, six letters:** guitar, stereo, Mozart, artist and violin are suggested by the actual model, without a bundled music category.
- **food, pattern `___t_`:** the controlled bank reduces to beets/pasta; Enter sends the first currently visible word. A delayed previous query cannot restore excluded words.

These are local Chrome fixture tests, not a live multiplayer-room trial. Semantic relevance is approximate; the model can include weaker associations such as school for music. Its color/tooltip is a search aid, not a claim of correctness.

## Measured latency

CPU measurements on this computer, with the bundled dictionary (3,712 raw entries):

| Operation | Time |
| --- | ---: |
| Cold Python search: load model/dependencies + encode 468 seven-letter candidates | 8,924 ms |
| Encode an unseen 587-word five-letter bank after loading | 351 ms |
| Encode the remaining 2,093 unseen entries for the full bank | 2,488 ms |
| New warmed-bank query (`fo` / `foo`) | 16–19 ms |
| Fully cached full-bank query, median of 20 | 9.2 ms |
| Cached full-bank query, maximum of 20 | 10.3 ms |
| Chrome input → rendered local suggestions, `f` → `food` | approximately 14–21 ms |

Model timings exclude the UI's 200 ms debounce, HTTP transport and rendering. Cold startup is intentionally reported separately. Immediate local suggestions remain usable throughout model loading. Reproduce with `ai-service/.venv/Scripts/python.exe tools/benchmark-search.py`; the output includes raw top semantic matches and encoding counts. No speed guarantee is made for other computers.

Saved screenshots and timing JSON are under `screenshots/validation-2.2.24/`.

## Setup and packaging

From the extension folder:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\ai-service\start.ps1 -SearchSetup
```

For later starts omit `-SearchSetup`. Stop an older service in its own terminal with Ctrl+C before restarting. The setup installs optional search dependencies in the service environment; weights stay under `ai-service/checkpoints/word-search`. The standard image-only requirements remain usable without semantic dependencies. Enable loopback access through the guesser's Local AI setup link and the large extension viewer's Local AI setup button. Toggle Related words off/on after granting access to retry.

Run `npm run package` for `dist/skribbl-auto-guesser-2.2.24.zip`. The allowlist contains the new shared JS module and excludes Python, weights, environments and validation artifacts. Load the folder unpacked or extract the ZIP, reload the extension, and refresh Skribbl. All pre-existing local changes were preserved. No user-owned service on port 8765 was started/stopped for validation; an owned temporary service on 8766 was used.
