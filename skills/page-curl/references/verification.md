# Visual regression checklist

Use default contrasting pages first; they make wrong-face and paper-stack artifacts easy to see. Start at sheet 3 of 6: left F is dark, right G is light. Advance once: the same physical light sheet must become left H, with right I dark. A dark page appearing behind the curling light sheet is expected occlusion; the light surface itself must not suddenly become dark.

1. Click next and previous. Inspect the start, near-vertical middle and landing. Front/back lettering must not be mirrored. Light pages retain their light base color through both directions.
2. Drag the light right page left by roughly 35% of the canvas width and release. It commits exactly one sheet. Drag the left page right to return.
3. Make a small 20px drag and release. The page returns without changing the sheet count. Cancel capture (or a pointercancel in a controlled harness) and verify the original sheet count.
4. Move the pointer over a page, then click. Hold the pointer still through landing. No underlying page should begin a secondary hover curl while the active sheet settles. Capture two settled frames separated by at least a second; when the pointer stays still they should match.
5. Repeated clicks during an active turn do not skip sheets. First and last sheet controls cannot advance beyond boundaries.
6. Resize to 696×920 and inspect mobile's tapered left paper roll and fanned upper edges. Next/previous turn single leaves; their blank backs remain white. Repeat at 390×844, then 800×1100 (still mobile due to portrait). At 1000×700 switch to desktop. Repeat switches while a turn is active: preserve the corresponding page/spread and leave exactly one canvas without shader errors.
7. Generate a custom four-face image book. Verify initial decoding, supplied face order, color space and a readable failure for a missing or corrupt image.

The self-test imports the published factories with injected mock renderers and deterministic per-harness clocks. It checks endpoint/depth continuity, input isolation, cancellation, hover suppression, boundaries and actual Three.js shader chunks. It also checks independent instances, enabled controls, missing-element diagnostics, failed/aborted texture cleanup, serialized responsive switching and cleanup during pending mounts. It does not replace visual inspection. Generator checks import the generated offline module graph.

Mobile numeric checks exercise cone-to-tangent continuity, cylinder and flat limits, all progress stages for 1/2/12/26 pages, and extreme grab tilts. Runtime checks cover stable texture ownership, idle endpoint stability, commit/rebound/cancellation, boundaries and teardown. A passing CPU test cannot prove GLSL compilation: a reserved GLSL identifier can pass JavaScript tests while making the GPU output blank.

Tests no longer insert code with source-string replacement or AsyncFunction. A regression imports real factory files copied with CRLF and exercises shader ownership, clicking, drag/rebound and teardown. `.gitattributes` keeps checked-out text at LF even when `core.autocrlf=true`; file copying may still introduce CRLF, so correctness does not depend on that rule. Do not ask users to change global Git settings.

For a sandbox without child-process permissions, the repository has `scripts/test-in-process.mjs`. Run it directly with Node, or use the installed skill's self-test. Both avoid the `node --test` worker runner. Framework compilation and browser rendering should be checked separately; CPU mocks cannot validate GPU output.
