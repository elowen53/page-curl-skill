---
name: page-curl
description: Build or repair interactive WebGL book page-turn effects using a tested Three.js and GLSL template, including double-sided pages, drag release, shadows and stable landing. Use for realistic book or magazine page curls, not ordinary carousels or full cloth simulation.
---

# Page Curl

Use the bundled implementation to reproduce the desktop cylindrical paper curl. Keep the user's framework, content and destination. The template is an independent reconstruction inspired by Paper Mono, not its source code or artwork. It does not implement Paper Mono's mobile conical curl.

## Generate a working baseline

Resolve paths relative to this skill folder. Node.js 18+ is required; no npm install or network is needed.

```sh
node scripts/create-demo.mjs --output /absolute/path/book.html
```

For supplied images, create a JSON configuration and pass `--config /absolute/path/book.json`:

```json
{
  "title": "My magazine",
  "startSheet": 1,
  "pages": ["front-1.png", "back-1.png", "front-2.png", "back-2.png"]
}
```

Image paths resolve relative to the config file. Each consecutive pair is the front/back of one physical sheet. Use an even count of at least two PNG, JPEG or WebP images. The generator embeds them and Three.js r162 into a standalone HTML. It validates config before writing and waits for all textures to decode before enabling interaction. Without images it generates the contrasting light/dark specimen pages.

For integration into an existing application, start from `assets/page-curl.js` and the generated HTML rather than rebuilding the shader from memory. Read [references/integration.md](references/integration.md) for porting, lifecycle and the limits of the lighting setup. Preserve the user's design; the specimen grid and lettering are replaceable content.

## Stability invariants

- Keep Three.js at 0.162.0 until shader compatibility has been verified. Validate shader include replacements when porting to another version.
- Use the same deformation function in surface and depth materials. Recalculate normals after deformation, and preserve the template's camera-facing normal convention for its fixed frontal camera.
- Each sheet owns its progress uniforms and stable front/back textures. Pick the face by triangle winding and mirror only the back UV. A change in color is legitimate only when revealing a differently colored page.
- Compute stack height continuously from physical sheet index and flip progress, never from the newly selected spread. Do not make a discrete depth or render-order change when the animation ends.
- Clear hover when a turn or drag begins and ends. Ignore pointer moves during automatic settling. Resume hover only on a new pointer move; snap residual interpolation below epsilon to the endpoint.
- Permit one active turn/drag. Clamp progress to [0,1], respect book boundaries and cancel an interrupted gesture back to its original side.

## Verify the result

Run `node --test tests` from the repository containing this skill when those tests are available. For a standalone installed skill, run `node scripts/self-test.mjs` to execute its bundled temporal and shader-compatibility checks.

Also inspect actual WebGL rendering in an allowed browser preview. Automated simulation does not prove pixel correctness. Exercise a white sheet forward and backward, a dark sheet, a committed drag, a short drag that rebounds, rapid repeated input and the first/last sheet. Observe intermediate frames and compare settled frames after the pointer stops. Check console shader errors. Report only checks actually performed and any browser/GPU limitations.

Use [references/verification.md](references/verification.md) for the reproducible visual checklist and known failure signatures. Run the generator and verify its output before handing it to the user. Do not imply that using this skill authorizes repository creation or publication; those require the user's request.
