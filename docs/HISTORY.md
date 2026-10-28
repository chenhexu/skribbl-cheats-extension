# Historical development notes

Archived from the previous README. These notes describe intermediate builds; follow [the current README](../README.md) and [usage guide](USAGE.md) for current instructions. Paths in the archive reflect the original README location.

# Skribbl Auto Guesser – Chrome Extension

## 2.3.0 local preview: AI inside Chrome, with a choice of engines

Click **Local AI setup** in the drawer, or beneath Related words. This opens a dedicated setup page rather than another copy of the drawing controls. Choose **Inside Chrome — GPU acceleration**, **Inside Chrome — CPU**, or **Python service — terminal**. Click **Load AI models** for Chrome, or **Check terminal service** for Python. Each feature shows its readiness state; **Test word-search speed** measures your selected engine. The existing Python choice is kept until you change it.

Both Chrome modes run **Related words**, **Find main subject (AI)** and **AI line detection** without Python, a terminal, localhost permission or an API key. Models, tokenizer, JavaScript and WebAssembly are packaged with the extension. Loading/warm-up takes a few seconds per browser session; public dictionary embeddings are precomputed. Queries/custom embeddings stay in memory. Chrome GPU support depends on the driver; choose Chrome CPU if unavailable. Model files make this ZIP larger than earlier builds.

**Inside Skribbl** is where you search and start drawing during your turn. **Open large viewer** opens the same image editor with more space for cropping and previews; it does not draw into the game. **Local AI setup** chooses the engine shared by both. The setup page explains these differences and keeps a link back to your uploaded image. Normal **Browser** line detection, Auto settings and manual subject marking remain local algorithms and need no AI loading.

Python remains available with the same fixed endpoint and optional permission. Its setup instructions are shown for that choice; an existing service can simply be checked. The source project includes `ai-service/start.ps1`; the extension ZIP does not include Python. Python may also use a CUDA GPU, so a terminal is a launch method, not a CPU-only restriction. No service was started or changed on port 8765 during browser-engine tests.

On this test machine, warmed word searches measured roughly 15–20 ms through real extension messaging. GPU image inference was substantially faster than Chrome CPU in the tested fixture. First load and GPU compilation are slower; use the setup page to warm models before playing and measure your device. See [browser AI validation and build details](docs/BROWSER_AI.md).

Reload the extension and refresh Skribbl; the panel should show **v2.3.0**. Select a Chrome engine in AI setup to use the new implementation. No Python restart is needed for Chrome AI.

### Existing colorful artwork and manual outline detail improvements

Auto now considers how many distinct game colors occupy large, smooth areas. Colorful artwork can use up to **24** color slots, with less shade merging, rather than the previous 7/10-color ceilings. A representative shaded wheel receives more slots while preserving each large colored wedge. Few-color drawings and noisy photographs retain simpler color choices; short drawing targets still reduce the color budget.

**Auto never changes Outline detail.** Its value stays as chosen through uploads, crops, Reset crop and re-enabling Auto. Manual slider edits retain the existing behavior of switching Auto off; re-enabling Auto keeps the chosen outline value. No Python restart is needed.

### Existing multiword recovery fix

**Not guessed? Show words** now preserves every word length after the full answer is revealed: **machine gun → 7 3**, instead of only 3. Three-word patterns and one-letter words are supported too. The parser reads the complete length label and uses it to preserve word boundaries in character-by-character hints, while retaining revealed letters. Hidden old hint labels and unrelated round/chat numbers are ignored. No Python restart is needed.

### Existing waiting-for-hint fix

Without a detected hint, search now shows **Waiting for hint…** and hides AI readiness/failure messages. Background model preloading still runs, but no semantic search request is made without eligible words. Once a hint appears, actual AI errors and ordinary **No matches** results are shown normally. Clearing the hint returns to the waiting state.

### Existing animal and related search improvements

Related words now includes broader offline animal coverage, including **animal → reindeer**, **insect → mantis**, and insect/bird/reptile/amphibian/arachnid/mammal families. Specific families feed the broad Animals category automatically. These are curated relationships, not AI inference. The optional pretrained local model still supplies additional semantic matches when available.

Animal searches also include parts and associated objects, such as **tail**, **antlers** and **zoo**, below actual animals. A general whole-term phrase rule finds **bear trap**, **bear claw** and other animal-containing phrases; it also works for other categories, such as **food → apple pie**. Phrase matching respects word boundaries and never bypasses hint lengths, revealed letters or spaces: a `4 4` hint can include bear trap, while an incompatible revealed letter excludes it. Hover explanations distinguish direct members from related items.

Each new drawing round clears the search and cancels stale AI results. Letter reveals, Stop and ordinary retries preserve the typed query; Related words and Closest first preferences stay selected. See [animal search validation](docs/ANIMAL_SEARCH_VALIDATION.md).

### Existing permission and dictionary fixes

Load this standalone folder at `chrome://extensions` → **Developer mode** → **Load unpacked**, then refresh skribbl.io. Disable another installed copy while testing. No extension build or web-app server is required.

**Chrome Web Store permission review:** the current package actively uses `storage` for shared drawer preferences and measured drawing latency. Real loaded-extension checks verify persistence across viewer tabs and a full browser restart; removing the permission breaks it. The old 2.1.0 unused-storage rejection needs an updated draft and accurate justification, rather than removal of this now-used permission. See [current submission text](STORE_PRIVACY_FIELDS.md) and [audit evidence](docs/STORE_PERMISSIONS_AUDIT.md). This verifies the stated technical issue and does not promise store approval.

Optional local AI access is now restricted to `http://127.0.0.1:8765/*` in the manifest, setup request and background check. Other loopback ports are excluded. Use Local AI setup again if Chrome requests a new grant after updating. No Python restart is needed for this permission change.

Fixed old saved dictionaries hiding words already present in the current bundle, such as **Spotify**. A release update now merges the bundled bank into your saved list while retaining custom entries. Explicit Remove choices are recorded from this release onward and stay removed across updates; Add restores them. Older caches did not distinguish a missing word from an intentional deletion, so the first migration restores missing bundled entries. No manual cache clearing is needed. With a seven-letter hint, **spo** finds **spoiler** and **spotify**.

Related words now recognizes **color / colour / colors / colours** and color terms in phrases and recognizable compounds, such as **color → red → redstone**, blueberry and greenhouse. These indirect matches say **Contains color term: red**; they do not claim that redstone itself is a color. Plain **stone → redstone** is also verified under the reported `r_____n_` hint, even before AI returns or when it gives a weak score. This transient stone miss could not be reproduced. See [dictionary/search regression checks](docs/DICTIONARY_SEARCH_VALIDATION.md).

Reload the extension and refresh existing Skribbl tabs. Python startup-preload behavior is retained when using that engine. Your panel title should show **v2.3.0**.

### Search model preloading (existing behavior)

The local service now preloads the installed search model and all bundled public-word embeddings in a background thread at startup. It prints **Word search ready** when complete, and the guesser shows **Warming up local AI…** / **Local AI ready · preloaded** with Related words enabled, even before typing. Restart the Python service once to activate this behavior. Start it before joining a room so startup work finishes ahead of your first search; loading still takes time if you type immediately after launching the service.

A roughly 5 MB public-dictionary embedding cache is saved under `ai-service/checkpoints/word-search/bundled-embeddings.npz` and reused on later starts. Model/dictionary changes or an invalid cache trigger rebuilding. Only bundled public words enter this file: queries, custom words and search results stay in memory. After warmup, the first five-letter food search measured 17–18 ms for model scoring on this computer, with zero candidate words left to encode. The 200 ms typing debounce remains. See [preload validation and timings](docs/SEARCH_PRELOAD_VALIDATION.md).

Check **Related words** under the guesser's search field. Text, spelling and bundled category matches update as you type; local AI adds meaning-based matches after a 200 ms typing pause. For example, **fish** can suggest dolphin and other ocean life, and **food** finds eligible foods. Every result must match the currently detected hint length, revealed letters and word spacing. Already-guessed words stay excluded. The complete eligible bank is searchable even beyond the automation queue's 1,200-word limit. Search never starts guessing or changes the automation queue order.

**Closest first** ranks matches; uncheck it for alphabetical order of the same results. Both checkbox choices are remembered. Green marks exact/plural matches, direct category membership or at least 80% normalized edit similarity; yellow/red show broader/weaker relationships. Hover over a word for its reason. Colors are relevance cues, not probabilities of the correct game answer. AI can still return weak associations; category tags are hand-authored, while semantic matches use a pretrained neural network. Ordinary substring search remains available with Related words off.

### Install and start optional word-search AI on Windows

From this project folder, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\ai-service\start.ps1 -SearchSetup
```

This installs the optional search dependencies and pinned **sentence-transformers/all-MiniLM-L6-v2** model, then starts the service at `http://127.0.0.1:8765`. The model is Apache-2.0; its upstream model card and full license are retained with the weights under `ai-service/checkpoints/word-search`, outside the extension package. Installation needs internet access; inference uses local files without downloading code/models. CPU works; CUDA is used when available. MiniMax and other hosted APIs are not used and no API token is needed.

If an older service is already using that port, stop it in its terminal with **Ctrl+C** before restarting. On later runs use:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\ai-service\start.ps1
```

In the guesser, click **Local AI setup**, then click **Local AI setup** in the large extension-owned viewer and allow loopback access. Return to Skribbl and toggle Related words off/on to retry. A missing model, missing access, timeout or offline service is reported explicitly; text/category matches remain usable. Startup preloads the model/public dictionary, while previously unseen custom words are encoded on demand. Repeated query/bank combinations are cached in the panel. See [search validation](docs/WORD_SEARCH_VALIDATION.md) and the newer [preload measurements](docs/SEARCH_PRELOAD_VALIDATION.md).

Package the standalone extension explicitly with `npm run package`. Load this folder unpacked for local testing; ZIPs are written under `dist/`. Refresh existing Skribbl tabs after reloading the extension. No store publication is performed.

### Automatic subject processing (existing behavior)

With **Use main subject** checked, **Process image** automatically finds a subject if no selection exists, applies Auto settings when enabled, then generates the drawing. Existing AI/manual selections are reused; unchecking keeps full-image processing without subject inference. Crop remains a separate choice. A missing/unavailable model reports its error and stops the pipeline. Stop or a settings/image change cancels the pending stages, including the Auto analysis after inference, so a late response cannot resume processing.

**Extension context invalidated** usually means the extension was reloaded/updated while the game tab still had its old connection. Refresh Skribbl (or reopen the large extension viewer). The drawer now shows that reconnect guidance instead of suggesting Browser line detection, which cannot repair the expired connection. See [Chrome's reload guidance](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#when-to-reload-the-extension).

### Smaller pinned drawing bar

Only **Process image**, **Start drawing** and **Stop** remain pinned while scrolling. They fit in one short row. Subject selection, Auto, drawing mode, Outline detail, Amplify and explanatory notes scroll normally, leaving more of the image visible. The local testing viewer keeps its existing Process/Stop actions. Reload the extension and refresh Skribbl, or hard-refresh the local viewer; no Python restart is needed.

### Amplify dark colors

Click **Amplify colors** beside the preview controls, then **Process image**. It starts at strength 70; adjust the Strength slider or click the button again to turn it off. Dark colors receive a gentle shadow/chroma lift and favor palette colors that retain their hue, so a navy sky can use the game's dark blue instead of collapsing into black. Neutral grays stay neutral, the deepest shadows can remain black, and bright highlights receive little lift. It amplifies color already present; it cannot recover a hue from a genuinely black or grayscale source.

Amplify is off by default. Its strength is remembered alongside drawing preferences, and Auto keeps your choice. Changing it enters manual mode, keeps the other settings and disables drawing until reprocessed. Original, crop, subject selection and the image sent to either local model are unchanged; amplification affects color simplification and the background swatch in light-lines mode. Preview, playback, PNG/JSON export and drawing use the resulting shared plan. Color count and the drawing budget still apply; allow at least three colors if you want a blue sky, black silhouettes and a light moon together. See [before/after and validation](docs/AMPLIFY_COLORS_VALIDATION.md). Reload the extension and refresh Skribbl, or hard-refresh the local viewer; no Python restart is needed.

### Open when undocking

Dragging Auto-Drawer out of the dock now opens its controls automatically. It restores the saved expanded window height even after collapsing the floating drawer and docking it again. The minus button still collapses it manually. Reload the extension and refresh Skribbl to activate this behavior.

### Optional subjects and scenery outlines

For landscapes, uncheck **Use main subject**, or choose **Draw → Full image / scenery** beside the main actions. Processing uses the full image with your color and outline settings; it ignores any retained subject mask. Your existing crop remains until you use **Reset crop**. Subject detection never crops automatically.

Click **Find main subject (AI)** to inspect a foreground selection separately; it also checks Use main subject. With Use main subject checked, **Process image** finds a subject automatically when a selection is missing, including for a remembered subject mode on a new upload. Existing selections are reused. Unchecking keeps the selection available, cancels pending subject inference, and prevents a late AI response from changing the next plan. The full-image choice is remembered like the other drawing preferences.

The Draw menu is always visible. **Subject first + simplified background** explicitly describes the faster mode: its optional background uses at most three colors, broad strokes and no outlines. For a detailed mountain/forest scene, use Full image / scenery instead. Browser edge detection also retains clear boundaries between flat source colors that map to the same game swatch. Thinning now preserves two-pixel diagonal lines that could previously collapse. Fine texture and gradual shading are still filtered. See [scenery validation and comparison](docs/SCENERY_VALIDATION.md).

### Upload thumbnail and drawer workflow

Uploaded or dropped images now appear as a small original thumbnail at the top. The large preview starts on **Final drawing** and shows the processed result after **Process image**; **Original** and **Main subject** remain available for inspection, cropping and selection editing.

The main controls are grouped in workflow order: **Find main subject (AI) → Auto settings → Process image → Start drawing**. Only Process, Start and Stop stay pinned while scrolling; the setup controls scroll normally. Other controls are under **More drawing settings**, initially folded in the panel. Click the Auto settings button to apply its recommendation again, or uncheck its checkbox to keep the current values manually. Moving Outline detail also switches to manual and requires processing again.

Auto analyzes color coverage and texture locally, without calling an AI model. Outline detail stays at your chosen value for every image type and drawing target. See [workflow validation and screenshots](docs/DRAWER_WORKFLOW_VALIDATION.md). Reload the extension and refresh Skribbl, or hard-refresh the local viewer with **Ctrl+Shift+R**; no Python restart is needed.

### Stable color-count reduction

Fixed Color count losing real hues at low values: a picture showing three mapped colors at a target of 24 could become only grays at a target of 3. Color analysis now uses a stable candidate set, maps it to actual game colors, then applies the requested limit. Reduction keeps representative palette colors rather than averaging unrelated hues into a new gray, and gives meaningful smaller colored areas weight against large neutral backgrounds. Grayscale inputs remain grayscale.

Color count remains a **maximum per layer**. Similar shades and game-palette collisions can produce fewer colors; black outlines can add another drawing color, while the drawing budget can omit some fills. Stats now distinguish **Color target**, **simplified colors**, and **drawing colors** instead of presenting one ambiguous count. The simplified count reflects the actual pixels after speckle merging, including both layers when a background is enabled. Reload the extension and refresh the game, then **Process image** again; hard-refresh the local viewer. See [color-count reproduction and validation](docs/COLOR_COUNT_VALIDATION.md).

### Smoother path playback

Path playback now reuses completed strokes and bucket fills instead of replaying the entire drawing on every frame. Direction arrows and pen-up travel use a separate cached layer, so they never affect a later bucket fill. Partial curves keep their continuous shape; bounded snapshots speed up rewinding. Cached surfaces are released when changing images/settings or closing the viewer. The panel and large viewer use the same renderer.

Playback also keeps fractional progress across frames, making its speed consistent across monitor refresh rates. A stalled/background frame resumes with a bounded step instead of jumping far ahead, and switching away from Drawing path pauses playback. In a synthetic busy-plan test, median late-frame render time fell from 257.5 ms to 1.8 ms; actual results depend on the image and computer. See [playback validation and measurements](docs/PREVIEW_PLAYBACK_VALIDATION.md).

Reload the extension and refresh Skribbl, or hard-refresh the local viewer with **Ctrl+Shift+R**. No Python restart is needed.

### Remembered drawer preferences

Auto-Drawer now remembers your **Drawing speed**, **Subject and background**, **Line detection**, **Drawing target**, and **Color amplification** choices across reloads/browser restarts. Auto leaves these five choices to you. The extension panel and large extension viewer share those preferences. The optional Python-served viewer remembers its own preferences in the browser for that local address.

Auto chooses color count, merging, gap closing, background removal, filling and treatment for each image. Outline detail stays manual. The Auto checkbox and its manual-edit behavior are unchanged. A remembered subject mode needs a fresh AI/manual selection for each new image; old crops, uploads and masks are not saved as preferences. Opening an explicit image session in the large viewer keeps that session's settings. Choose your preferences once after updating; future reloads restore them. See [preference validation](docs/DRAWER_PREFERENCES.md).

### Drawing Stop and Escape

In **Colors + outlines**, Stop now cancels pending input, releases the mouse, and waits for debugger cleanup before enabling Start again. **Escape** also stops drawing, including while the canvas holds the pointer. Stop recognizes input over its visible button even when the canvas receives the event. Canceled starts and delayed command responses cannot resume an old job. Commands that receive no response within three seconds stop the run rather than submitting more drawing input. Stop does not close the game's room connection or send an undo/clear command.

Reload the extension and refresh Skribbl to activate this fix. The local Python service needs no restart. Chrome tests cover a real Stop click during a long drag, retargeted pointer input, Escape, delayed acknowledgements and restart. Live-room server ping and the reported kick have not been reproduced; this update fixes cancellation, without promising to resolve every cause of a room disconnect. See [Stop validation](docs/DRAWING_STOP_VALIDATION.md).

### Verified drawing colors

Fixed a preview/game color mismatch: skin and brown regions could paint in the previous blue when a floating panel covered their palette swatches. Colors + outlines now selects the actual swatch through the game's primary-color pointer handler and verifies its SVG/mobile color preview. It checks again before every continuous path and bucket click, including consecutive operations in the same color. A failed selection stops with an explicit error before painting the next region. If an integration requires trusted palette input, the fallback only clicks a coordinate that actually hits that swatch. Keep the palette uncovered if that fallback reports an error. Canvas drawing continues through trusted CDP input.

Reload the extension and refresh the game. Image processing, the AI masks, and planned color mapping are unchanged; the correction makes execution follow the preview. See [palette validation and before/after](docs/PALETTE_EXECUTION_VALIDATION.md).

### Manual guesses after spam cooldown

Fixed manual guesses remaining blocked after spam cooldown. **Spam cooldown** now counts down while automation is stopped, and clicking a candidate works when it reaches **0s**, including after repeated warnings and Stop. The first warning waits **4 seconds**, the next **8**, then up to **12**; clicking early shows the actual remaining wait and does not queue a hidden send. Automatic guessing retains its repeated-warning pause and recovery buffer. Stop cancels automatic recovery but keeps the manual candidate buttons and their search filter available. You do not have to click Start to send manually after the timer ends.

Candidate clicks, search Enter and number shortcuts all use explicit manual sending. They still allow only one unconfirmed submission at a time, keep spam-rejected words available, and count a guess as sent only after chat confirmation. The automatic retry cap cannot permanently lock an explicit manual retry. Older recovery timers no longer clear a newer cooldown from an unconfirmed attempt. Reload the extension and refresh Skribbl to activate the fix. See [validation](docs/MANUAL_SPAM_RETRY_VALIDATION.md).

### Edit subject parts

If the AI omits a mountain, car part or another object, click **Edit subject parts**. Hover the image to preview a connected color group in cyan, then click to **Add to subject**. Change **Selection action** to **Remove from subject** for a red preview and click to subtract it. Green marks the existing selection; edits preserve every other selected part. Hover alone does not change the selection. **Part grouping** controls how similar adjacent shades must be: lower values select smaller groups; higher values can join several facets. Disconnected shapes stay separate even when they share a color.

When colors connect the object to its background, choose **Select by → Outline (polygon)**, click around the part, then **Apply outline** or press Enter. It uses the same Add/Remove action and retains the rest of the AI mask. Escape clears an unfinished outline. **Undo selection** reverses up to 12 edits (Ctrl+Z with the preview focused). Click **Done selecting**, then **Process image** to inspect the updated drawing and path. Empty selections disable processing/cropping instead of falling back to the full image. The original **Mark subject** still replaces the entire selection.

The editor works without AI too. It groups connected colors locally in the browser; it does not semantically recognize a whole object. Review the hover preview and use Outline if a group includes background. Editing uses the full uploaded frame while preserving the crop, so hidden/cropped parts can be corrected consistently. The updated binary mask and editor preferences transfer between the compact panel and expanded viewer, with identical cropped plans. Auto stays enabled and recomputes its recommendation when you finish editing; manual processing values stay unchanged. Selection changes invalidate the current drawing plan.

Reload the extension and refresh the game for this update. Hard-refresh the local viewer with **Ctrl+Shift+R**. It uses the existing service and models. See [selection validation](docs/SUBJECT_PARTS_VALIDATION.md).

### Brush-picker startup fix

Fixed the **Game brush controls not found** startup failure: the drawer now opens the native brush-size picker through its click handler, re-queries its buttons, allows up to one second for initialization, and verifies the selected size before sending any drawing stroke. Screen-position clicks could be intercepted while opening the picker. An open size menu is closed before palette clicks and on Stop/completion/failure, so restarting cannot accidentally select a brush size instead of a color. Stop and turn loss cancel the initialization wait; a picker that remains unavailable fails explicitly. Reload the extension and refresh the game for this fix; the Python service needs no restart. See [validation](docs/BRUSH_PICKER_VALIDATION.md).

### Subject-first drawing and Fast mode

For a plane on a runway, upload the image, click **Find main subject (AI)**, inspect the green selection in **Main subject**, then click **Process image**. Selection enables **Subject only (fastest)**, which omits the runway. Choose **Subject first, background later** to add a simplified background after the subject's fills and outlines. **Full image (original order)** still paints large color regions first; selecting the subject is what changes that order. The AI can miss thin parts or select the wrong object: use **Mark subject**, click around the intended object and click **Finish subject** to replace it manually. **Crop to subject** optionally frames the selection with a margin; resetting the crop preserves the selection.

**Drawing speed → Fast** is the new UI default. It merges more tiny color speckles and drops more short texture lines, reducing mouse operations rather than exceeding the game's input rate. Balanced retains more detail. Auto recommendations use the selected foreground when focus is enabled; all controls remain editable. Preview, playback, JSON export and execution share the same ordered plan. Background uses broad strokes protected from the finished subject, and is optional when the drawing target is exhausted. Targets below 20 seconds omit background planning. Processing and both model times are shown separately; actual drawing may exceed the estimate.

Subject detection uses the optional local **U2NETP** foreground model (4.7 MB). With the service stopped, install its checkpoint and start the updated service:

```powershell
.\ai-service\start.ps1 -SubjectSetup
# Or, using an existing Python environment with the service dependencies:
python ai-service/download_subject_model.py
python ai-service/app.py
```

For a fresh installation, run `start.ps1 -Setup -SubjectSetup`. If the service is already open, press **Ctrl+C** in its window before restarting. Refresh the local viewer with **Ctrl+Shift+R**; reload the extension and refresh the game. The old running service cannot serve the new `/api/subject` endpoint. Extension AI requests still require **Local AI setup** in the expanded extension viewer. Browser line detection and manual subject marking work without either AI model. Check `/health` for separate line-model and subject-model readiness. Weights stay outside the extension ZIP; upstream Apache-2.0 architecture/license are in `ai-service/u2net.py` and `ai-service/LICENSE.u2net`. See [subject implementation](docs/SUBJECT_FOCUS_PLAN.md) and [validation](docs/VALIDATION_2.2.9.md).

Drawing-turn detection now ignores the previous round's reveal panel after it slides off the canvas. The old check measured its retained size, which could reject your next turn even with Brush/Fill active. The new check uses the active game overlay and its actual visibility/overlap. An active transition overlay, unfinished word selection, and another player's turn have distinct start conditions; a visible overlay or lost drawing turn still cancels a running stroke and releases input. If the overlay is still closing, wait for it to clear and click Start drawing again.

**Color count** now supports 2–24 in the panel, expanded viewer, processing engine, and saved plans/sessions. It is a maximum number of representative source colors: merging similar shades, mapping onto the game palette, and the drawing budget can produce fewer drawn colors. Auto continues to suggest a smaller count when it saves useful drawing time; you can raise it manually.

Auto now recognizes sparse bright linework on a mostly dark background and selects **Drawing treatment → Light lines on dark background**. This paints the background in its closest game-palette color, then traces the bright ink once in white. It suppresses faint grid lines and skips gray antialiasing regions and added black borders. The background is required and runs before the light strokes; the remaining drawing budget goes to lines. Broad white objects on a dark field retain standard processing.

You can select this treatment manually for a blueprint. **Outline detail** controls the threshold for weaker ink and short details; a higher value keeps more. All processing controls stay editable, including Color count, Merge similar colors, and Near-white removal. Unchecking Auto keeps every suggested value and the treatment. Editing one of those three color-region controls switches Drawing treatment to **Color regions + black borders**, explains the switch beside Auto, and preserves the other values. Editing a setting directly from Auto also enters manual mode. This avoids accepting a slider edit that light-lines processing would ignore. Auto/manual state and treatment are shared by the small panel and large viewer. Selecting AI still requires the local service: its result filters bright-ink components, while the strokes remain white. Bright grids as strong as the subject can still survive, and the game’s minimum 4-pixel brush limits fine detail. No semantic grid/text removal is promised.

### Chat-confirmed guesses

Guesses are submitted one at a time. A word counts as sent and updates **Last guess** only after a fresh matching message from your own player appears in chat, a matching system close-hit reply appears, or the active guess receives your solved-word message. Another player's message cannot confirm your submission. Dot-prefixed guesses and the plain close-hit resend are tracked separately.

**Spam detected** rejects the pending submission: its word stays available and is retried after the existing cooldown. No chat confirmation within 2.5 seconds also retains the word, waits, and retries while running; after five attempts the guesser pauses. Stop cancels the pending wait and automatic retry; Start can retry it. A new round clears pending deliveries. Chat pruning and copied history do not falsely acknowledge guesses. The configured delay is a minimum after confirmation, so a 1 ms setting no longer fires multiple unconfirmed guesses. Only one form submission is used per attempt.

### Automatic image settings

Open Auto-Drawer and leave **Drawing mode → Colors + outlines (new)** selected. Upload/drop an image, optionally **Crop on original**, adjust colors/merge/detail, then **Process image**. Use **Final drawing** and **Drawing path** to inspect what will actually be drawn. Start drawing during your own turn. **Legacy modes** retains Realistic and Imitate.

**Auto settings** starts checked. Upload an image and it suggests color count, shade merging and small-gap closing from its colors and texture. Monochrome drawings favor two colors; colorful artwork with large smooth regions can use up to 24 color slots; photos use stronger merging. A short drawing target favors fewer colors. Auto uses bucket fills and keeps near-white removal off. It preserves your chosen outline detail, detector and drawing time, and never enables local AI by itself. This is a deterministic local heuristic for a useful starting point, not a guarantee of the best possible result.

Editing any processing slider or selector immediately unchecks Auto and keeps all the suggested values apart from your edit. Recheck Auto to restore its recommendation. With Auto checked, cropping/resetting or loading a new image updates the suggestion; with it unchecked, your manual values stay in place. The expanded viewer carries both the mode and settings across. Path playback does not turn Auto off. Processing remains explicit: click **Process image** when ready. JSON plans include the suggestion in `plan.auto` while Auto is enabled.

**Color filling → Closed regions + bucket** is now the default. It draws each region's closed boundary in its own color, seals its holes, then clicks the game's Fill tool inside it. Black borders follow the same color boundaries last, using the game's smallest 4-pixel brush. Tiny color speckles merge into adjacent regions (under 64 pixels in Fast, 12 in Balanced), avoiding hundreds of strokes along antialiased edges. **Close small gaps** defaults to 4 pixels and joins nearby aligned line ends without joining parallel lines. **Brush strokes** retains the previous hatch-fill implementation for comparison.

Tool selection now calls the game's actual toolbar click handler and verifies its `selected` state before sending canvas input. A blocked Fill selection stops with an error instead of placing a brush dot. Redundant hover moves and fixed 100 ms tool waits are removed. Sealing paths use fewer points within a 1.25-pixel bound; spline fallbacks use a simplified polyline within the original 1.5-pixel error bound. Held moves respect the game's 90 Hz input limit so rushing cannot silently drop a corner.

The same image, crop and visible settings now give the same processed colors and ordered paths in both viewers. Previously, a slow draw's saved latency changed which regions survived budgeting on the next process. Observed latency now changes only the displayed estimate, stored separately in `plan.timing`. Execution can still skip whole optional regions when the outline reserve is reached; skipped work is reported.

**Open large viewer** opens the same controls in an extension tab and carries the uploaded image/crop/settings across. You can also open `dev-line-art/studio.html` directly for Browser processing, or use the local server below.

### Optional Informative Drawings AI

Browser mode works independently. The AI mode runs the author's pretrained model on your computer; no hosted inference service or API key is used.

From this folder in PowerShell:

```powershell
# First-time isolated dependency and checkpoint setup (~17.2 MB for the checkpoint;
# PyTorch dependencies are larger):
.\ai-service\start.ps1 -Setup

# Later:
.\ai-service\start.ps1
```

If Python already has Flask, Pillow, and PyTorch, you can instead run:

```powershell
python ai-service/download_model.py
python ai-service/app.py
```

Open **http://127.0.0.1:8765** for the large local viewer. In the extension-owned large viewer, click **Local AI setup** and allow the optional loopback permission, then select **Informative Drawings AI**. The service defaults to CPU when CUDA is unavailable. Model time is displayed separately from drawing time. Missing weights/service and inference failures are shown explicitly; select Browser to continue without AI.

To restart the viewer/service, press **Ctrl+C** in its PowerShell window, then run the following. Leave that window open and refresh the viewer with **Ctrl+Shift+R**:

```powershell
cd F:\Projects\skribbl-auto-guesser-extension
python ai-service/app.py
```

The checkpoint comes from the [author's public demo](https://huggingface.co/spaces/carolineec/informativedrawings/blob/main/model.pth), verified against SHA256 `c686ced2a666b4850b4bb6ccf0748031c3eda9f822de73a34b8979970d90f0c6`. It stays under ignored `ai-service/checkpoints/` and is excluded from extension packages. The inference architecture is adapted from [Informative Drawings](https://github.com/carolineec/informative-drawings); its MIT notice is in `ai-service/LICENSE.informative-drawings`. No CLIP, torchvision, or training/depth models are required. Check separately downloaded weight terms before redistribution.

### Processing and timing

- Images are fit to 800×600 without stretching. Crop coordinates refer to that normalized image. Near-white removal defaults off; automatic contrast stretching is disabled in the new mode.
- Six representative colors are the default, mapped to the current 26-color game palette. Merge similar colors controls perceptual LAB shade merging. Bucket fills preserve complete regions rather than omitting individual hatch lines. Enclosure checks reject an unsafe fill explicitly; Brush strokes remains available.
- Connected outlines are thinned, traced, and fitted to curves with a 1.5-pixel fitting tolerance. One continuous path is one mouse drag; corners and disconnected paths stay separate. No random wobble or undo is applied.
- Color fills precede black outlines. The adjustable 60-second target initially assigns 40 seconds to fills and 20 to lines. Small/expensive details may be omitted; counts are shown before drawing. Estimates include strokes, moves, and tool changes and adapt to observed CDP latency. They are not a deadline guarantee.
- Stop, a lost drawing turn, or a moved/disappearing canvas cancels the current run and releases input. The new mode requires CDP and does not silently fall back to the legacy socket path.
- PNG export simulates the planned strokes and actual 4-connected bucket operations. JSON export is a version-2 `DrawingPlan` with dimensions, palette, settings, crop, metrics, and ordered operations. Paths contain `points`; atomic color regions have `kind: "region"`, closed `contours`, and interior `seeds`. Every operation has `id`, `stage`, `colorId`, and `brushSize`. The executor also accepts old version-1 path plans. Playback uses blue circles for bucket clicks; annotations never affect the fill simulation.

### Validation and packaging

```powershell
npm ci
npm test
python -m unittest discover -s ai-service -p test_service.py
# Uses installed Chrome; override SAG_TEST_CHROME if needed:
npm run test:ui
npm run package
```

The package command checks JavaScript syntax and manifest references, then writes `dist/skribbl-auto-guesser-2.2.23.zip` plus a JSON manifest with source revision, modified-working-tree status, and SHA256. It uses an explicit file allowlist; weights, Python service, dependencies, screenshots, tests, and old ZIPs are excluded. It does not publish anything.

After code changes, reload the extension at `chrome://extensions` and refresh the Skribbl tab. If you are already running the local Python server after changing its code, restart it too.

Standalone Chrome extension project for the Skribbl.io Auto Guesser. Runs only on `https://skribbl.io/*`.

**Related repo:** The userscript source and word-list app live in [Skribbl_hints](https://github.com/chenhexu/skribbl.io_hints_remastered) (sibling folder `Skribbl_hints`). This folder is a separate project so the extension (and future features like auto-drawer) can be developed and versioned independently.

- **Privacy:** [PRIVACY.md](PRIVACY.md) — extension does not collect user data.
- **License:** MIT (see [Skribbl_hints/LICENSE](https://github.com/chenhexu/skribbl.io_hints_remastered/blob/main/LICENSE)).

## Development / load unpacked

1. Open `chrome://extensions/`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this folder.

## Icons (for Chrome Web Store)

The manifest has no `icons` entry by default so the extension loads unpacked without extra files. For store submission, add an `icons` folder and this to `manifest.json`:

```json
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
```

Use 16×16, 48×48, and 128×128 PNGs.

## Source of truth

This standalone folder is the extension source. The userscript and reference extension inside Skribbl_hints are older variants. Do not overwrite `content.js` from them: the standalone extension has additional drawer and UI behavior.

## Publishing to Chrome Web Store

1. Run `npm run package` and review the ZIP under `dist/`.
2. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
3. For the existing store item, upload a new version, review the listing/privacy changes, then submit when ready. Local testing does not publish an update.
