# Archived experiments

This folder preserves older implementations and tools for reference. It is excluded from the installable extension package.

- `imitate/`: the original drawing pipeline, with its restoration notes.
- `resize-images.js`: the old padded-image helper. It writes only to ignored `local/legacy-resized/`; use `node tools/prepare-user-screenshots.cjs` for current store screenshots, which crop to the required aspect ratio without padding.

The active extension code remains at the project root and in `browser-ai/` and `dev-line-art/`.
