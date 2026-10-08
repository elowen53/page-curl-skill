# Narrow-screen Paper Mono reverse engineering

Observed on 2026-10-08 at https://paper.design/mono, by reading its publicly served client bundles and operating its narrow-screen canvas. The original assets were kept in local scratch storage for analysis. This repository ships independently written geometry and specimen artwork.

## Confirmed implementation

The application chooses a separate mobile magazine component unless `(min-width: 768px) and (orientation: landscape)` matches. It uses Three.js r162 and custom vertex/fragment GLSL. Both the desktop and mobile meshes start from a subdivided plane of width 1 and height 1.377 (64 horizontal, approximately 88 vertical segments). The narrow version is a full 3D cone-wrap model rather than a scaled desktop spread or a CSS flip.

Each mobile leaf has its own front artwork and a blank paper back. Some desktop spreads have separately prepared mobile artwork. Thus the original's mobile artwork list is not always a simple pairing of the desktop files. This template uses the same supplied list in reading order, and can be given alternate artwork in a separately generated mobile book.

For normalized turn progress p, ordinary rotation is 2πp; the leading edge uses `lead = 2π(1-(1-p)²)`. Actual spine rotation is capped at the book opening angle; the remaining angle is the cone wrap cap. Opening grows from about 100° to 190° with a fourth-power folded-depth curve.

Cone top radii grow approximately .04 → .18 across leaves, bottom radii .01 → .05. Each row's radius is `r(y) = rTop + (height/2-y)*slope`, with `slope=(rBottom-rTop)/height`. This taper produces the wide upper roll and tight lower spine shown in the user's screenshot. Radius offsets are cumulative deterministic random weights with power 7.5 and seed 41.5, creating irregular clumps of fanned upper edges. Folded-depth spacing is also nonuniform.

Before the cap, vertex positions follow the cone surface. Beyond the cap, the paper continues along the surface tangent, leaving a flat readable leaf attached to a curled spine. A separate tilted cylindrical tail deformation bows the free edge backward during the turn. Its displacement is projected along the local cone normal. At rest, unturned leaves receive a depth-dependent pile bulge (maximum around .08 in unit-width coordinates), a bulge peak near x=.4, and a tapered drop toward the outer edge. Earlier rolled leaves progressively flatten after about fifteen turns; the original also flattens at book closure.

The original recalculates finite-difference normals and uses matching depth deformation for shadows. Lighting includes a hemisphere fill and a shadow-casting directional light with a 2048² shadow map. Fine paper grain, ink roughness, translucency and wrinkle fields add material detail; they are separate from the main shape.

## Interaction and reproduction scope

The original's horizontal drag scale is about 1.2 canvas widths per full turn, release commitment about .1 progress, click slop 5px, and click duration about 1.2s. Touch movement distinguishes horizontal turning from vertical scrolling. Long presses accelerate repeated turning; finishing the original book can restart it automatically.

The bundled mobile implementation reproduces cone taper, tangent continuation, tail bend, stack spacing, pile bulge, double-sided rendering, click/drag/rebound and stable endpoints. It shares the exact observed responsive condition with the desktop model and disposes the old renderer on switching. It deliberately ends on the last readable leaf. Accelerated long pressing, automatic replay, original material noise and original artwork are outside this version. These observations describe the public site at the inspection date and are not a claim of access to its authored source repository.
