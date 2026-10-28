Skribbl Auto Guesser + Auto Drawer 2.3.7 adds a safer drawing startup, independent outline detail and corrected Chrome Web Store packaging, with refreshed instructions and real user screenshots.

### Install

Download **skribbl-auto-guesser-2.3.7.zip**, extract it into a permanent folder, then open `chrome://extensions` → Developer mode → Load unpacked. Select the extracted folder and refresh Skribbl. Disable an older installed copy to avoid duplicate panels.

The ZIP includes the browser AI models and runtimes. Chrome CPU/GPU modes require no Python, npm, paid AI account or API key. Choose an engine in **Local AI setup**, click **Load AI models**, and wait for readiness before playing. GPU support depends on the device; Chrome CPU and the optional Python companion service remain available.

### Changes since 2.3.3

- Attach the drawing debugger first and wait at least 400 ms before sending drawing input, including when canvas coordinates stay unchanged. Wait for layout stability and cancel promptly if the canvas/viewport moves later. Chrome's debugger notice remains visible.
- Adjust **Outline detail** without disabling Auto settings or cancelling an in-flight suggestion. Other image settings keep their existing manual/Auto behavior.
- Keep only the extension's root `manifest.json` in the package. AI model metadata now uses `model-index.json`; packaging rejects duplicate or nested manifests.
- Update the extension name, summary, permission explanations and store materials. Include five listing screenshots, three alternatives and untouched source captures.
- Add drawing/search examples to the README and organize branding sources, test images and archived experiments into documented folders.

Word suggestions stay within the detected hint bank. Image previews are plans, and drawing speed/detail depends on the image, browser and game. Optional AI runs on the user's computer. Required permissions remain Storage and Debugger; Offscreen and Python localhost access remain optional. Runtime/model assets and permission declarations are unchanged from 2.3.6.

### Other downloads

**chrome-web-store-kit-2.3.7.zip** contains listing text, screenshots, icons, permission explanations and reviewer instructions. It is separate from the installable extension ZIP. The adjacent extension **.zip.json** records SHA256, source revision and package files.

The user submitted version 2.3.7 to the Chrome Web Store for review. This GitHub release is an unpacked-install download; the store listing is awaiting Google's review and has no installation URL yet.

Validation: 94 Node checks and 27 browser checks passed; one Python-service-only browser check was skipped. Browser tests used isolated profiles and synthetic game markup, including simulated debugger-banner timing. Package checks verify a single root manifest and unchanged submitted runtime/model bytes. See `docs/VALIDATION_2.3.7.md` for scope.

See the repository's README, usage guide and privacy policy for setup, data use and troubleshooting.
