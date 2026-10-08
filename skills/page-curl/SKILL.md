---
name: page-curl
description: Build or repair responsive WebGL book page-turn effects using a tested Three.js and GLSL template, with desktop double-page cylindrical curls, mobile single-page conical rolls, drag release, shadows and stable landing. Use for realistic book or magazine page curls, not ordinary carousels or full cloth simulation.
---

# Page Curl

Use the bundled implementation to reproduce desktop cylindrical curls and narrow-screen conical rolls. Keep the user's framework, content and destination. The template is an independent reconstruction inspired by Paper Mono; it includes original specimen artwork.

These are instructions for the AI harness, not setup tasks for the end user. Implement, integrate and check the result yourself within the available environment. Prefer the exported factories over copying or rewriting their source.

## Generate a working baseline

Resolve paths relative to this skill folder. Node.js 18+ is required; no npm install or network is needed.

```sh
node scripts/create-demo.mjs --output /absolute/path/book.html
```

For supplied images, create a JSON configuration and pass `--config /absolute/path/book.json`:

```json
{
  "title": "My magazine",
  "mode": "auto",
  "startSheet": 1,
  "pages": ["front-1.png", "back-1.png", "front-2.png", "back-2.png"]
}
```

Image paths resolve relative to the config file. Use an even count of at least two PNG, JPEG or WebP images. Desktop mode pairs consecutive images as front/back of each physical sheet. Mobile mode uses each image as one leaf's front, with a shared blank paper back. The generator embeds them and Three.js r162 into a standalone HTML. It validates config before writing and waits for textures to decode before enabling interaction. Without images it generates light/dark specimens.

`mode` defaults to `auto`: desktop requires both width ≥768px and landscape orientation; all other viewports use mobile. This is the observed Paper Mono breakpoint, including wide portrait windows. `desktop` or `mobile` forces a model. `startSheet` is zero-based desktop spread depth; `startPage` overrides it with a zero-based artwork index. Switching modes preserves the artwork index, rounded down to its spread when entering desktop; entering mobile clamps the closed-book index to the last visible leaf. Each switch must dispose the old scene before mounting its replacement.

For integration, import `mountPageCurl` from `assets/responsive-controller.mjs`. Pass `THREE`, `stage`, `prev`, `next`, `status` and `config`; all DOM elements belong to the instance. Low-level `mountDesktop` and `mountMobile` exports are also available. No selector replacement or handwritten responsive controller is needed. Keep asset import paths together, including `assets/package.json` for Node ESM compatibility.

Read [references/integration.md](references/integration.md) for the injection manifest, typed API, async cancellation and sandbox guidance. For Vue use [references/examples/PageCurl.vue](references/examples/PageCurl.vue); for React use [references/examples/PageCurl.jsx](references/examples/PageCurl.jsx). They cover prop changes, serialized remounts, unloading during texture loading and React StrictMode cleanup. Read [references/mobile-reverse.md](references/mobile-reverse.md) when adapting geometry. Preserve the user's design; specimen artwork is replaceable content.

## Stability invariants

- Keep Three.js at 0.162.0 until shader compatibility has been verified. Validate shader include replacements when porting to another version.
- Use the same deformation function in surface and depth materials. Recalculate normals after deformation, and preserve the template's camera-facing normal convention for its fixed frontal camera.
- Each sheet owns its progress uniforms and stable front/back textures. Pick the face by triangle winding and mirror only the back UV. A change in color is legitimate only when revealing a differently colored page.
- Compute stack height continuously from physical sheet index and flip progress, never from the newly selected spread. Do not make a discrete depth or render-order change when the animation ends.
- Clear hover when a turn or drag begins and ends. Ignore pointer moves during automatic settling. Resume hover only on a new pointer move; snap residual interpolation below epsilon to the endpoint.
- Permit one active turn/drag. Clamp progress to [0,1], respect book boundaries and cancel an interrupted gesture back to its original side.
- On mobile, use tapered cone wrapping with a tangent continuation and a separate tilted tail bend. A 180° CSS rotation or scaling down the desktop spread cannot reproduce the rolled spine. Preserve different top/bottom radii, cumulative per-leaf spacing and pile bulge.
- Keep endpoint cone parameters fixed after landing. Mobile has no idle hover animation. Dispose listeners, observers, animation loop, textures, geometries, shadow maps and renderer when switching models.

## Verify the result

Run `npm test` from the repository when its generator tests are available. If the harness prohibits child processes (`spawn EPERM`), run `node scripts/test-in-process.mjs` from the repository; it imports both suites in the current process. For an installed skill, run `node scripts/self-test.mjs`. These do not require npm installation or a bundler. Diagnose sandbox build restrictions separately from renderer failures.

The self-test imports the same exported factories used by applications. Do not add source-string instrumentation to port it. Keep each mock renderer's clock local to its harness and use the same time origin for `performance.now()` and frame timestamps. Capture landing after the turn duration has completed, then compare a later idle frame.

Also inspect actual WebGL rendering in an allowed browser preview. Automated simulation does not prove pixel correctness. Exercise both models with a white sheet forward/backward, a dark sheet, a committed drag, a short drag, rapid input and boundaries. Observe intermediate frames and compare settled frames after the pointer stops. Check cone taper and fanned edges at narrow width, repeat wide/narrow switches, and inspect wide portrait mode. Ensure exactly one canvas and no console shader errors. Report only checks actually performed and any browser/GPU limitations.

Use [references/verification.md](references/verification.md) for the reproducible visual checklist and known failure signatures. Run the generator and verify its output before handing it to the user. Do not imply that using this skill authorizes repository creation or publication; those require the user's request.
