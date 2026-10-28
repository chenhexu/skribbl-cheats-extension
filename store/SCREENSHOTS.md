# User screenshots for the store listing

Upload the five numbered PNGs in `store/screenshots/`, in this order. They are RGB PNGs, cropped to 16:10 and resized proportionally to an accepted screenshot size, with no added padding or altered UI.

| Order | Screenshot | Size | Original capture |
| --- | --- | --- | --- |
| 1 | [Swordfish drawing and preview](screenshots/01-swordfish-1280x800.png) | 1280 × 800 | `exemple_screenshot_new5.png` |
| 2 | [Cola drawing in a game](screenshots/02-cola-1280x800.png) | 1280 × 800 | `exemple_screenshot_new.png` |
| 3 | [Main subject selection](screenshots/03-main-subject-640x400.png) | 640 × 400 | `exemple_screenshot_new3.png` |
| 4 | [Truck drawing preview](screenshots/04-truck-drawing-640x400.png) | 640 × 400 | `exemple_screenshot_new4.png` |
| 5 | [Related-word search](screenshots/05-related-words-640x400.png) | 640 × 400 | `exemple_screenshot_new7.png` |

The small panel captures use 640 × 400 to avoid unnecessary enlargement. Their crops retain the selected preview tab and full truck, or the hint, query, Related words control and first two result rows. The cola crop retains the complete in-game bottle and main controls; the lower preview continues beyond the crop.

Three alternatives are ready in `store/screenshot-alternates/`: [Gladiator](screenshot-alternates/gladiator-1280x800.png), [Yo-yo](screenshot-alternates/yo-yo-1280x800.png) and [Hint filtering](screenshot-alternates/hint-filtering-1280x800.png). Replace a numbered screenshot with an alternative if preferred; keep at most five uploads.

All eight byte-for-byte originals are preserved in `store/references/`. Captured version labels, annotations, player names and chat are retained as supplied. Cropping/resizing does not recreate artwork or text. Earlier demonstration screenshots remain under `store/assets/` for reference; they are separate from the five selected user captures.

Run `node tools/prepare-user-screenshots.cjs` to rebuild these images. `store/screenshot-crops.json` records each crop, original dimensions and SHA256. The full submission kit includes both the five-image set and alternatives; the separate `dist/store-screenshots-2.3.7.zip` contains only the five numbered upload images.
