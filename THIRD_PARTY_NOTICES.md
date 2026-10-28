# Third-party components

Project code is licensed under [MIT](LICENSE). Dependencies and pretrained models retain their upstream licenses; this project's license does not replace them.

| Component | Purpose | License / upstream |
| --- | --- | --- |
| ONNX Runtime Web 1.22.0 | Browser GPU and WebAssembly inference | MIT; [Microsoft ONNX Runtime](https://github.com/microsoft/onnxruntime) |
| Transformers.js 3.8.1 tokenizer | MiniLM tokenization | Apache-2.0; [Hugging Face Transformers.js](https://github.com/huggingface/transformers.js) |
| all-MiniLM-L6-v2 | Semantic word embeddings | Apache-2.0; [model card](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2); pinned revision `1110a243fdf4706b3f48f1d95db1a4f5529b4d41` |
| U2NETP | Foreground subject masks | Apache-2.0; [U-2-Net](https://github.com/xuebinqin/U-2-Net) |
| Informative Drawings | Image-to-line conversion | MIT; [Informative Drawings](https://github.com/carolineec/informative-drawings) |

The extension ZIP includes complete licenses under `browser-ai/runtime/` and `browser-ai/models/`. Python copies are retained under `ai-service/` and with its downloaded checkpoints. Browser models are ONNX exports of the local checkpoints; trained weights are unchanged. The U2NETP export adapts equivalent pooling operations for the fixed browser input size. Export provenance and asset hashes are recorded in `browser-ai/models/manifest.json`.

Browser code is bundled from npm dependencies; `package-lock.json` records the dependency tree. Development-only components such as Playwright, esbuild and sharp are not shipped as Node packages in the extension. The public word-vector cache contains bundled dictionary words only.

The sample wheel and precision/blueprint illustrations used in tests and current store screenshots are project-generated fixtures. The extension name refers to compatibility with skribbl.io and does not imply affiliation with its operator or Google.
