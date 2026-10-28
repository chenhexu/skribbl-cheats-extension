# Upload 2.3.7 to the Chrome Web Store

Use the existing item that previously had the 2.1.0 rejection.

1. Open the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) and select your existing extension item (previously named **Skribbl Auto Guesser**). Uploading the new package changes its name to **Skribbl Auto Guesser + Auto Drawer**.
2. Open **Package**, choose **Upload new package**, and select `skribbl-auto-guesser-2.3.7.zip`. Confirm that the uploaded version is **2.3.7**. Upload the installable extension ZIP, not the separate store-preparation kit or GitHub's source-code ZIP.
3. Open **Store listing**. Paste the description from [listing-description.txt](listing-description.txt). Use the title, links and other prepared fields in [store/README.md](README.md).
4. Add the five numbered PNGs from `store/screenshots/`, or extract `dist/store-screenshots-2.3.7.zip`. Two are 1280 × 800 and three are 640 × 400. See [the screenshot guide](SCREENSHOTS.md) for upload order and alternatives; keep at most five images in the listing. Use the cropped copies for upload; `store/references/` preserves every full original. The optional promotional tile in `store/assets/` is 440 × 280 and belongs in the promotional-image field. The icon is `icons/icon128.png`.
5. Open **Privacy practices**. Copy the single purpose and matching permission explanations from [STORE_PRIVACY_FIELDS.md](../STORE_PRIVACY_FIELDS.md). Required permissions are **Storage** and **Debugger**; **Offscreen** and Python loopback access are optional. Select **No, I am not using remote code**. Read the data-use descriptions and certify answers that match the linked privacy policy.
6. Set the privacy-policy URL to `https://github.com/chenhexu/skribbl-cheats-extension/blob/main/PRIVACY.md`.
7. Add the reviewer testing instructions from [store/README.md](README.md#reviewer-notes--copy-into-testing-instructions), including the explanation that this replaces the old unused-storage rejection. The current package actually uses Storage for shared preferences.
8. Complete **Distribution** and your developer contact details. Choose **Public** for a public listing or **Unlisted** if you want installation by link.
9. Save the fields, resolve dashboard errors, and choose **Submit for review**. The confirmation dialog lets you choose automatic publication after approval or publication later.

Use the freshly built local ZIP at `dist/skribbl-auto-guesser-2.3.7.zip`. Earlier 2.3.3/2.3.4 ZIPs contain an extra AI metadata file named `manifest.json` and fail the store upload check. The current package includes the 2.3.5 metadata rename and verifies exactly one root `manifest.json`. The submission kit is only a folder of text and listing images; do not upload it as the extension package.

Sources checked October 28, 2026: [updating an item](https://developer.chrome.com/docs/webstore/update), [listing images](https://developer.chrome.com/docs/webstore/images), [privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy). This checklist does not upload or submit anything to your account.
