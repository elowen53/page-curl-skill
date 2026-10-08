# Visual regression checklist

Use default contrasting pages first; they make wrong-face and paper-stack artifacts easy to see. Start at sheet 3 of 6: left F is dark, right G is light. Advance once: the same physical light sheet must become left H, with right I dark. A dark page appearing behind the curling light sheet is expected occlusion; the light surface itself must not suddenly become dark.

1. Click next and previous. Inspect the start, near-vertical middle and landing. Front/back lettering must not be mirrored. Light pages retain their light base color through both directions.
2. Drag the light right page left by roughly 35% of the canvas width and release. It commits exactly one sheet. Drag the left page right to return.
3. Make a small 20px drag and release. The page returns without changing the sheet count. Cancel capture (or a pointercancel in a controlled harness) and verify the original sheet count.
4. Move the pointer over a page, then click. Hold the pointer still through landing. No underlying page should begin a secondary hover curl while the active sheet settles. Capture two settled frames separated by at least a second; when the pointer stays still they should match.
5. Repeated clicks during an active turn do not skip sheets. First and last sheet controls cannot advance beyond boundaries.
6. Resize to a narrow viewport, then restore it. The aspect, sheet count and interaction state survive; no shader errors or duplicate canvases appear.
7. Generate a custom four-face image book. Verify initial decoding, supplied face order, color space and a readable failure for a missing or corrupt image.

The self-test simulates actual template execution with a mock renderer and deterministic timestamps. It checks endpoint/depth continuity, isolation of simultaneous input, cancellation, hover suppression, boundaries and compatibility with actual Three.js shader chunks. It does not replace the visual checklist. `npm test` also checks packaging and generated output.
