# Offline categories and new-round searches — 2.2.28

The reported reindeer/mantis misses came from incomplete offline category coverage. Both words already exist in the bundled dictionary. The screenshots show the optional AI service unavailable, so no model associations were being added.

## Changes

- Add curated mammals, insects, birds, reptiles, amphibians and arachnids. Each family feeds Animals automatically; fish and animal ocean-life entries also feed Animals. Mantis and reindeer receive direct category membership. Spiders and scorpions remain arachnids, not insects.
- Add explicit lower-ranked animal parts and associated objects, including tail, antlers, wings, zoo and aquarium. These lists are curated, not AI-generated and not exhaustive.
- Match category terms inside space/hyphen-delimited phrases, without arbitrary substring splitting. Animal finds bear trap and bear claw through bear; food finds apple pie. This general rule uses the supplied eligible hint bank only. A phrase association ranks below a direct animal and has an explanatory hover label.
- Clear the typed query and shortcut hint in startNewRound. The existing round reset aborts/discards old semantic requests. Ordinary hint reveals, Stop and retries keep the query; search preferences remain selected.
- Preserve optional local neural semantic search, model preload/cache, literal mode, alphabetical sorting and delivery/spam handling. No Python changes, hosted API calls or new permissions.

## Verification

All 72 Node checks and 24 Chrome search/guesser checks passed, including real local-model searches. Added checks cover offline reindeer/mantis matches, plural forms, animal inheritance, unrelated-word exclusions, weaker part/phrase ranking, alphabetical result-set equivalence, strict two-word hints and revealed letters, retained queries during hint reveals/Stop, new-round clearing, and ignored late AI replies. Final-version smoke checks rerun the new browser scenarios after updating version metadata.

Screenshots are saved under screenshots/validation-2.2.28. Browser tests use isolated synthetic game pages and a temporary service on port 8766. The user's service on 8765 and live game tabs are untouched. Reload the extension and refresh Skribbl to see v2.2.28; no service restart is required.

## Follow-up: waiting for hint — 2.2.29

Search previously displayed a background AI-health error and No matches while no hint was available. It now hides service status until a hint exists and shows Waiting for hint… in the candidate area. Preloading is preserved. Actual service failures remain visible when a hint is present, and No matches still describes a valid hint/query with no results. Solved rounds hide stale search status too.

Hint polling also handles removal of a previously visible hint, comparing the current game hint with the stored raw hint. Previously it ignored empty hints, which could leave old candidates/errors visible when the original hint element was not observed. The browser regression starts without a hint, fails the health request, verifies zero semantic calls, adds a hint and checks real error reporting, checks a true No matches result, then removes the hint and verifies the waiting state returns. No Python changes or new permissions are required.
