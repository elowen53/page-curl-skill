# Integration

The baseline uses a fixed frontal PerspectiveCamera, a shared 64×88 segmented plane, independent sheet uniforms and two textures per sheet. `paperPosition(uv)` performs a tilted cylindrical curl followed by a rotation about the spine. The mesh and custom depth material use that identical function. The Three.js revision is pinned because `onBeforeCompile` replaces internal shader chunks.

The fragment normal is made camera-facing in view space (`normal.z`). This is a deliberate convention for this frontal magazine presentation. If adding camera orbit, arbitrary paper orientations, normal maps or tangents, reassess the normal and shading model and validate both faces from every camera angle. This template does not claim to be general physically accurate double-sided cloth shading.

## Existing framework

Wrap scene creation inside the component's mount effect and keep state private to the instance. Scope selectors to a root element; retain shared texture/geometry ownership so they are disposed exactly once. On unmount stop `setAnimationLoop`, disconnect ResizeObserver, remove pointer listeners, dispose page textures, materials, depth materials, shared geometry, shadow receiver geometry/material and renderer, and remove the canvas. Do not rebuild the renderer on every progress change. React StrictMode must leave only one live instance after a mount/unmount/remount cycle.

For multiple books, avoid global IDs and register controls against the instance's root. Port the template's single-active-interaction rule and pointer capture; do not combine independent CSS opacity/crossfade animations with paper settling.

Image pages are static artwork, not interactive HTML surfaces. Choose an aspect ratio of approximately 1:1.377 to avoid stretching. User-supplied artwork stays in the generated deliverable; the GitHub package contains only independently drawn specimen pages.

## Color and shadows

Set image textures to SRGBColorSpace. Front and back texture ordering must follow each physical sheet, not each visible spread. Near/far shadow bounds must cover the actual light-to-paper distances; enormous depth ranges lose shadow precision. If diagnosing dark flashes, first check face choice, normals, self-shadow precision and paper-stack intersections. Do not hide the issue by whitening every texture or switching off all shadows.

## Delivery

The generator produces offline standalone HTML using a data URL for the pinned Three.js module. It requires a modern browser with WebGL. Hosted environments with a restrictive Content Security Policy may block inline scripts or data-module imports: extract scripts into local files and explicitly permit the chosen same-origin scripts. Do not weaken unrelated application CSP settings.

The baseline is a desktop cylindrical curl that also accepts pointer gestures on narrow viewports. It is not a reproduction of Paper Mono's dedicated mobile cone model, long-press rapid flipping, baked FBM wrinkle field or fine ink/paper material.
