# How to use Skribbl Auto Guesser + Auto Drawer 2.3.7

[Installation](../README.md#install) · [AI engine](#choose-an-ai-engine) · [Word search](#word-search-and-guessing) · [Drawing](#drawing-workflow) · [Troubleshooting](#troubleshooting)

## Choose an AI engine

Click **Local AI setup** in Auto-Drawer or under the guesser's search box. This opens a separate setup page shared by both features.

1. Select **Inside Chrome — GPU acceleration** or **Inside Chrome — CPU** for AI without a terminal. The saved default is Python until changed.
2. Allow optional Chrome AI access when choosing that engine or clicking **Load AI models**. Wait for word search, subject detection and line detection to report ready. First loading and GPU compilation can take several seconds; do this before joining a round.
3. Optionally click **Test word-search speed**. Its result measures your computer, not a guaranteed speed on other devices.
4. Return to Skribbl. You can close the setup tab. **Unload models** releases the Chrome AI worker; a later AI request can load it again.

GPU mode needs an available WebGPU adapter. If setup reports no supported GPU or an inference error, explicitly select CPU and load again. Neither Chrome mode needs loopback access, Python, an API key or a paid inference account. There is no paid request quota in these local engines; memory, device speed and the game's sending limits still apply.

### Optional Python terminal service

This option is for users who prefer the companion Python service. It may use CPU or CUDA depending on the installed dependencies and hardware. The terminal launches it; it does not necessarily mean CPU inference.

Download/clone the **source project**, install Python, and run this from the project folder in Windows PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\ai-service\start.ps1 -Setup -SubjectSetup -SearchSetup
```

Initial setup downloads Python dependencies and the three models. Keep the terminal open while using the service. Later starts need only:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\ai-service\start.ps1
```

Select **Python service — terminal** in Local AI setup, grant access to `http://127.0.0.1:8765/*` when prompted, and click **Check terminal service**. Stop the service with **Ctrl+C** in its terminal. If that port is already occupied, stop your previous service before starting another copy. The extension ZIP does not contain the Python project.

## Word search and guessing

The hint determines the eligible bank **before** search runs. An eight-letter hint admits only eight-letter words; a `4 4` hint admits matching two-word phrases. Revealed letters narrow that bank further. Without a detected hint, the panel waits rather than searching the full dictionary.

With **Related words** off, typing performs ordinary text matching. With it on, results combine spelling similarity, curated categories and, when ready, the selected semantic model. Text/category results can appear before the model response. Semantic search refreshes after a short typing pause; outdated responses are discarded.

Examples depend on the current hint:

| Search | Possible related matches |
| --- | --- |
| `animal` | reindeer, tail, bear trap |
| `insect` | mantis and other eligible insects |
| `fish` | dolphin or other ocean life |
| `food` | eligible foods and phrases such as apple pie |
| `stone` | redstone |

These are relationships, not guarantees that each word appears under every hint. Direct category members rank ahead of weaker associations. Some categories are hand-authored; model scores provide additional meaning-based relationships.

**Closest first** sorts by relevance. Uncheck it to alphabetize the same matches. Green marks strong/direct matches; yellow and red mark weaker ones. Hover over a suggestion to see its explanation. Search relevance is not a probability of the correct answer.

Click a suggestion to send it, press **Enter** for the first result, or use **1–9** for the corresponding visible result. **Start** sends the automatic queue at the configured delay; the search field does not reorder that queue. **Stop** stops guessing. Use a sensible delay: the game can reject rapid messages regardless of the extension's setting.

After **Spam detected**, sending pauses for a cooldown and rejected attempts remain eligible to retry. A chat attempt is confirmed from game feedback rather than assumed accepted immediately. Repeated warnings can extend recovery. Do not repeatedly click during cooldown. New drawing rounds clear the typed search and old results.

Expand **Show details** for parsing/status, custom-word **Add**, **Remove** and **Dedupe**, and refresh settings. **Refresh parse** rereads the current game hint. **Not guessed? Show words** restores suggestions after an incorrect guessed-state detection and preserves multiword lengths. Dot prefix is an optional legacy sending mode; leave it off for ordinary guesses.

## Drawing workflow

Drag the Auto-Drawer header outside the guesser to open it as a floating panel. Drag its header to move it, or resize from any edge or corner, including the top. Both panels can sit flush against the browser content edges. Drop the drawer header onto the guesser, or click **Dock back**, to return it.

1. Expand **Auto-Drawer** and select **Colors + outlines**. Upload or drop an image. The small original thumbnail stays near the top; the processed preview appears below.
2. Choose **Full image / scenery** for a landscape or an image you want to keep in full. Leave **Use main subject** unchecked. No foreground AI runs during processing in this mode.
3. For an object, check **Use main subject** and choose **Subject only (fastest)** or **Subject first + simplified background**. **Process image** automatically runs subject AI if no selection exists. **Find main subject (AI)** lets you inspect that selection separately. Existing manual/AI selections are reused.
4. Leave **Auto settings** on to suggest settings from the current image, then click **Process image**. Auto leaves **Outline detail** unchanged. In the 2.3.4 preview, changing Outline detail also keeps Auto enabled; raise it yourself for precise linework, then process again. Editing an auto-controlled setting turns Auto off while keeping the other suggested values; re-enabling Auto keeps your outline detail.
5. Compare **Original**, **Main subject**, **Simplified colors**, **Detected lines** and **Final drawing**. **Drawing path** and **Play path** show the planned order; **Pen-up travel** displays movements between strokes.
6. Return to the Skribbl panel and click **Start drawing** during your own drawing turn. Keep the game canvas and tools visible. Chrome shows a debugger banner while drawing. In preview 2.3.6, the drawer attaches first and waits at least 400 ms for the banner and layout to settle before sending input. If the canvas or viewport moves later, drawing stops; keep the window position/size and page scroll steady. **Stop** also cancels during this startup pause and releases drawing input.

The large viewer processes images and previews plans. It cannot draw into a game by itself. If you change settings or the image, process again before starting. Thick, fairly uniform lines automatically use a matching wider pencil when that preserves their shape; irregular regions keep bucket filling. Drawings may omit small regions/outlines to fit the selected time target; inspect the plan statistics. The target is an estimate, not a guaranteed finish time or a game rate-limit bypass.

### Correct a subject selection

- **Mark subject:** outline the object manually when AI is unavailable or chooses the wrong object.
- **Edit subject parts:** hover over a connected color region to highlight it, then click to add/remove it. Change **Part grouping** if adjacent colors are grouped too broadly or narrowly.
- Choose **Outline (polygon)** to trace a more precise part, then **Apply outline**. **Undo selection** reverses the last edit; **Done selecting** exits selection mode.
- **Crop to subject** crops around the selection. Finding/marking a subject and cropping are separate actions. **Crop on original** and **Reset crop** provide manual framing.

Process again after correcting the selection. **Subject first** depends on that mask: omitted parts will not receive foreground priority.

### Useful drawing settings

| Setting | How to use it |
| --- | --- |
| **Drawing speed** | Fast drops more small details; Balanced retains more. |
| **Drawing target** | A shorter target reduces work; more time can retain detail. |
| **Color count** | Up to 24 simplified colors per layer. This is a ceiling; merging and the game palette can produce fewer. Black outlines may add a drawing color. |
| **Merge similar colors** | Lower it when distinct colors disappear; raise it to simplify nearby shades. |
| **Amplify colors** | Lift dark hues before simplification, for example dark blue in a night scene. Adjust Strength and process again. |
| **Outline detail** | Increase for precise linework; reduce when texture creates excessive lines. Auto never changes it. |
| **Drawing treatment** | Use Color regions + black borders for ordinary pictures; Light lines on dark background suits blueprint-like artwork. |
| **Line detection** | Browser uses a local algorithm; Informative Drawings AI uses your selected AI engine. |
| **Close small gaps** | Helps seal regions for bucket filling. Too much can merge fine features. |
| **Near-white removal** | Removes near-white areas; keep at zero if white is part of the subject. |

Drawing speed, target, subject/background mode, line detector and color amplification are remembered separately from per-image Auto suggestions. Images and subject masks are not saved as preferences.

Drag the drawer out of its dock to expand it; resize the floating panel or use **Dock back**. Only the short Process / Start / Stop row stays pinned while you scroll. **Download preview PNG** saves the preview; **Download plan JSON** saves the plan for inspection.

## Troubleshooting

| Message or symptom | Action |
| --- | --- |
| **Extension context invalidated** | The extension was reloaded/updated. Refresh the Skribbl tab to reconnect. Browser line detection can work without AI, but refreshing repairs the extension connection. |
| **Waiting for hint** | Wait for a guessing round or click Refresh parse if the game already shows a hint. |
| **Local AI: Failed to fetch** | Check the chosen engine. For Python, start the service and grant port 8765 access; for terminal-free use, select Chrome CPU/GPU and load models. Ordinary text/category search remains available. |
| **Local AI service failed (413)** | The local server rejected an oversized request. Try a smaller image, or switch to Chrome AI. This is not a paid quota message. |
| **GPU unavailable** | Select Chrome CPU in AI setup and load models again. |
| **Not your drawing turn / brush controls not found** | Wait for your drawing turn and keep the game tools visible. Refresh after an extension update. Check that another copy of the extension is not active. |
| **Preview loses color** | Check Simplified colors first. Increase Color count, lower Merge similar colors, try Amplify colors, and process again. The fixed game palette cannot reproduce every source shade. |
| **AI cuts off part of the object** | Use Edit subject parts or Mark subject, or switch to Full image / scenery. |

If a problem persists, [open an issue](https://github.com/chenhexu/skribbl-cheats-extension/issues) with the extension/browser version, selected engine, steps and relevant status text. Share an example image only if you are comfortable making it public. Do not include API tokens, private chat logs or other secrets.
