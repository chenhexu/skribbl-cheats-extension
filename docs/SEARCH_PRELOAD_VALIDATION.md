# Search startup preloading — 2.2.25

The optional local AI service now warms the installed MiniLM model before the first search, in a daemon thread started by the app factory. Flask can serve health checks and the image viewer while warmup runs. Missing search weights skip preloading; unavailable search dependencies/errors do not stop image processing or browser/category matching.

## What is warmed and saved

- The model/tokenizer, all 3,708 distinct normalized bundled public words, and one generic query inference are warmed at startup. The service prints **Word search ready** when complete.
- Public embeddings are atomically saved in `ai-service/checkpoints/word-search/bundled-embeddings.npz` (5,309,820 bytes in this build). Only the source's bundled bank enters this file. Request candidate lists, custom words, queries, query embeddings and search results are never written there.
- Reuse checks model revision, sequence length, the full normalized bundled bank, shape, float32 type, finite values and normalized-vector lengths. Missing/incompatible/invalid caches rebuild. Pickle loading is disabled. A read-only cache directory produces a warning but leaves warmed in-memory search usable.
- Preload encodes in batches of 64 and releases the model lock between batches, allowing an early interactive search to proceed. Searches still score only their submitted hint-filtered bank. Unknown custom words are encoded on demand.
- The cache and weights remain outside the extension ZIP. CPU and CUDA use the same public-cache format. No new Python dependency or hosted API is introduced.

## Readiness and early typing

`GET /health` extends `wordSearch` with `warming`, `preloadState`, `preloadedWords`, `totalWords`, `preloadMs`, `cacheHit` and `cacheWarning`. `ready` becomes true after background preload finishes (or after ordinary model loading when preload was explicitly disabled for an embedded/test app). `lazy` is false for startup preloading.

With Related words enabled, the guesser checks readiness before any query. It displays **Warming up local AI…** with progress, polls once per second while warming, and then displays **Local AI ready · preloaded**. Disabling Related words cancels the readiness request/timer. Existing query generation checks, cancellation, hint filtering, scoring, sort order and the 200 ms inference debounce remain in place. Immediate text/category results work during startup. A busy/timed-out early request is retried automatically once the readiness poll observes completion; service/model failures still remain explicit.

The expanded extension viewer's Local AI setup also reports warmup status. Restart the Python service to activate this change; reloading only the extension cannot replace a running Python process. Startup does still take time: start the service before joining a room and use its ready indication before expecting the first AI result immediately.

## Actual CPU measurements

Two separate fresh Python processes used the real installed model:

| Run | Background startup work | First five-letter `food` search | Newly encoded candidate words |
| --- | ---: | ---: | ---: |
| Build initial public cache | 15,399 ms | 17.1 ms | 0 |
| Restart and reuse public cache | 8,907 ms | 18.4 ms | 0 |

The initial run overlapped other Python validation, so these startup numbers are observations rather than a controlled CPU benchmark. The actual temporary Flask service subsequently reported 6.3 seconds to preload with the cache. The first search uses 585 eligible public words. Timings exclude the panel's debounce, HTTP transport and rendering. Custom words can add encoding time. Preloading moves startup work ahead of searching; it does not remove the time required to load a model after launching Python.

Reproduce from the extension project:

```powershell
ai-service/.venv/Scripts/python.exe tools/benchmark-preload.py --label restart
```

Reports are saved under `screenshots/validation-2.2.25/`. `preload-first-start.json` and `preload-restart.json` record real health and timing data.

## Checks performed

- 13 Python checks passed, including real semantic inference, cache restart reuse, changed dictionary/model metadata, corruption rebuilding, public-only persistence despite an interleaved private/custom search, nonblocking startup, single warmup thread, lock release between batches, cache write failure, missing models/dependencies, and original line/subject service behavior.
- 20 Chrome checks passed: all existing guesser/chat-confirmation/spam checks, existing search checks, plus readiness before typing, warmup progress, automatic recovery of an early busy search, hiding readiness when disabled, and a real first request with zero candidate encodes after preload. Screenshots were visually inspected.
- Nine targeted Node checks passed for matching/ranking, stale responses, cache reuse and background cancellation/timeout behavior. JavaScript syntax/package checks cover the updated panel and viewer.
- No live multiplayer room was used. The owned test service ran on 8766; the user's 8765 service was not restarted or stopped.

## Loading and packaging

Reload the extension and refresh Skribbl. Stop an older service with Ctrl+C in its terminal, then start the updated service from this project directory:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\ai-service\start.ps1
```

An existing model installation is reused. For a fresh installation add `-SearchSetup`. Package explicitly using `npm run package`, producing `dist/skribbl-auto-guesser-2.2.25.zip`. Startup files and public cache stay in the local service source folder; the ZIP contains only extension files and existing local changes remain preserved.
