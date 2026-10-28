# Subject selection and subject-first drawing (2.2.9)

Implemented in 2.2.9. Informative Drawings remains the optional line detector. A separate, optional U2NETP model identifies salient foreground; manual polygon selection works without a model or service. The earlier SAM 2 proposal below has been replaced by this smaller automatic foreground model.

For the reported airplane photograph, prioritize the airplane silhouette and its recognizable details; make runway texture and other background detail optional. A rectangular crop alone cannot separate the runway below the wings from the airplane.

## Interaction and inference

**Find main subject (AI)** calls the fixed loopback `/api/subject` endpoint. The upstream [U-2-Net](https://github.com/xuebinqin/U-2-Net) U2NETP architecture and author-provided 4.7 MB weights run with PyTorch on CPU or CUDA, using the author's 320×320 normalization. The returned grayscale mask is resized to the uploaded image dimensions, intersected with transparency, and thresholded in the UI. Architecture and Apache-2.0 license are included in `ai-service`; a SHA256-checked installer downloads weights separately. No training, CLIP, depth, torchvision or OpenCV dependencies are needed.

The green **Main subject** view makes the selection reviewable before processing. AI can miss a canopy, thin landing gear or a competing object; **Mark subject** replaces the selection with a manually closed polygon. This is salient foreground selection, not a guarantee that the model understands the intended game word. Empty/misaligned masks and missing models fail explicitly; there is no full-frame fallback.

**Crop to subject** frames the selection with a margin. The immutable source mask is transformed through the same crop/aspect mapping as the image onto 800×600 coordinates. Reset crop restores the frame while retaining the selection. Full image keeps the original order; selecting a subject defaults to Subject only. Subject first, background later adds the optional background. The mask, crop, settings and Auto state transfer between the compact panel and expanded viewer.

Checkpoint files stay outside the extension ZIP. `/health` reports foreground readiness separately. The background worker accepts only the fixed local subject/line endpoints with the existing optional loopback host permission. Stop or edits invalidate pending inference and processing. CUDA is used when available; CPU is supported. Restart an old service to expose the new endpoint.

## Planning and execution

1. Process foreground colors, safe bucket enclosures and continuous outlines with the shared engine. Required light-lines bases precede their ink within the subject layer.
2. Order all subject fills and outlines before any background operation, tagged `priority: subject`. The executor keeps this finalized subject group required rather than applying the old optional-fill reserve to it.
3. When enabled and the target is at least 20 seconds, allocate 80% to foreground planning and the rest to background. Background uses at most three colors, stronger shade merging, broad brush strokes and no texture outlines. Trim it to the overall estimated budget; during execution skip optional background once the target elapses. An estimate cannot guarantee room-timer completion.
4. Remove the subject plus a six-pixel protective margin from background alpha. Fill-footprint checks keep later strokes outside it, including holes and disconnected parts. Background never uses bucket clicks that could flood the finished subject.
5. The same ordered DrawingPlan drives preview, playback, exports, estimates and CDP execution. Changing mask, crop or controls invalidates the plan. Fast mode merges regions below 64 pixels instead of 12 and removes more short lines; the game's 90 Hz held-move pacing remains intact.

See [2.2.9 validation](VALIDATION_2.2.9.md) for tested cases and measured synthetic timing. The exact uploaded jet photograph is not a local fixture; it still needs the user's visual check, especially thin parts and which object was selected. Manual marking replaces the mask rather than editing individual AI pixels. Competing objects, people against clutter and fine bicycle parts remain useful follow-up image checks.
