# Integration

## Published API

Import `mountPageCurl` from `assets/responsive-controller.mjs` and the pinned Three.js namespace from `assets/three.module.min.js`. Keep the asset directory together. Low-level files export `mountDesktop` and `mountMobile`; they are no longer inline function bodies. The generator embeds this same controller, and self-tests import the same factories. Do not concatenate function bodies, replace selectors or rewrite the responsive controller.

```js
const book = await mountPageCurl({
  THREE, stage, prev, next, status,
  config: {mode: 'auto', pages: [], startPage: 0},
  signal: abortController.signal
});
// Component cleanup, including before mount resolves:
abortController.abort();
book.dispose();
```

Elements come from framework refs or selectors scoped to a component root. There are **zero global DOM selector references** in the factories and controller. Each book owns four DOM elements and an instance. Defaults come from the stage's owner document, including iframe windows.

## Injection manifest

| Input | Required / default | Purpose |
| --- | --- | --- |
| `THREE` | Required, revision 162 | Renderer, geometry, material, texture and shader APIs |
| `stage` | Required element with positive layout size | Canvas attachment, sizing, owning document |
| `prev`, `next` | Required buttons | Turn callbacks and loading disabled state |
| `status` | Required element | Page count and errors |
| `config` | Optional | `mode`, image URL `pages`, `startPage`, `startSheet`, optional `title` |
| `signal` | Optional AbortSignal | Cancel before a handle exists, or release an existing mount |
| `environment.createCanvas` | Owning document's canvas creation | Procedural artwork |
| `environment.document` | Stage's owning document | Sandboxed HTML/Markdown capture and SVG image decoding |
| `environment.fetch` | Owning window's bound method | HTML/Markdown/SVG URL sources; PDF.js manages its own URL loading |
| `environment.ResizeObserver` | Owning window's constructor | Stage resize observation |
| `environment.performance` | Owning window's performance | Instance clock; inject `{now}` in tests |
| `environment.devicePixelRatio` | Owning window's ratio, fallback 1 | Pixel density |
| `environment.AbortController` | Owning window's constructor | Listener and mount cancellation |
| `environment.matchMedia` | Owning window's bound method | Auto mode; not needed for forced mode |
| `onError` | Optional controller callback | Later responsive errors; initial errors reject mount |

Types are in `assets/api.d.ts` and declarations beside the exported modules. Top-level `mode`, `pages`, `startPage` and `startSheet` override `config` fields on the controller. Selective environment overrides support mocks. `debug` and controller `factories` are test seams; normal integration does not require them.

All handles provide `page()`, `next()`, `previous()` and synchronous, idempotent `dispose()`. The controller adds `mode()` and `ready()`. Page is an artwork index: desktop spread depth multiplied by two, or mobile visible leaf. It changes at committed turn start. `ready()` waits for queued responsive mounts, **not** for a turn to land.

## Framework lifecycle

Use [PageCurl.vue](examples/PageCurl.vue) in an existing Vue 3 application or [PageCurl.jsx](examples/PageCurl.jsx) in React. Copy assets with the example and adjust its two relative imports if relocating it. No application scaffold or dependency installer is included. The lifecycle follows [Vue mount/unmount hooks](https://vuejs.org/api/composition-api-lifecycle.html) and [React effect cleanup](https://react.dev/reference/react/useEffect).

Both receive `pages`, `mode` and `startPage`. They snapshot props, abort previous mounts, serialize replacements, ignore stale completions and release resources on unmount. React supports StrictMode's setup/cleanup/setup cycle. Vue reports an `error` event. Image lists require even length; page zero is the first image. A start index beyond the list rejects explicitly.

Pass an AbortController signal **before awaiting mount**. Cleanup that only disposes a handle after awaiting can miss texture decoding. Aborting releases the canvas immediately; late textures are disposed when they arrive. Failed loads release acquired resources. Serial replacement keeps one renderer active per component.

Auto mode uses `(min-width: 768px) and (orientation: landscape)`. It preserves artwork position, rounds to the containing desktop spread and clamps the closed-book index on mobile. Old scenes are disposed before replacements. Do not keep both renderers behind CSS visibility.

## Rendering constraints

Both models use a shared 64×88 segmented plane and independent uniforms. Desktop uses paired artwork; mobile uses separate fronts and blank backs. Surface and shadow share deformation; normals are recalculated. Supplied textures use SRGBColorSpace, with page aspect near 1:1.377.

Camera-facing normals in view space are deliberate for this frontal presentation. Camera orbit, arbitrary orientation and normal maps require revisiting the convention. Shadow bounds must cover actual light-to-paper distances. Diagnose wrong-face textures, normals, precision and stack intersections for dark flashes.

Pages accept images and static snapshots of HTML/Markdown, PDF or SVG. Read [content.md](content.md) for descriptors, pagination, dependencies and format limits. Framework examples pass descriptors through unchanged. Keep `assets/vendor/` with the other assets. Core deformation is included; accelerated long press, automatic book-end replay and original fine paper/ink noise are outside the current scope.

## Restricted harnesses

The generator and factory modules do not spawn subprocesses or need npm dependencies. Standard `node --test` may spawn workers. If it fails with `spawn EPERM`, use repository `node scripts/test-in-process.mjs`, or installed-skill `node scripts/self-test.mjs`. These import test suites in the current process.

A project's esbuild/Vite may still need subprocess permissions. Treat those errors as environment failures. Do not add a bundler to generate the offline demo, change global Git settings or assume elevation is available. Skipping installation scripts may leave build tools unusable; choose it only when dependency requirements are understood.

Keep mock clocks local to each harness, with the same time origin for `now()` and animation timestamps. Negative frame deltas are clamped defensively, but shared clocks can still mislead assertions. Capture endpoint snapshots after turn completion, then compare a later idle frame.

## Delivery

The generator embeds this ESM module graph into offline HTML. WebGL is required. Restrictive CSP may block inline scripts or data imports; integrate the exports as same-origin modules under the existing policy. Do not weaken unrelated CSP settings.
