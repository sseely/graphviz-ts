<!-- SPDX-License-Identifier: EPL-2.0 -->
# Architecture decisions — orientation=land

## ADR-1: Rotation via group transform, not ptf coord rotation
- **Context:** native keeps inner SVG coords in the unrotated frame and rotates
  via the graph `<g>` transform `rotate(-job->rotation)` (svg_begin_page);
  verified — b68 inner coords are conformant to native, only transform/dims
  differ.
- **Decision:** emit `rotate(-job.rotation)` in `emitGraphGroupOpen`; never bake
  rotation into inner coords.
- **Consequences:** conformant achievable; `applyRotation`/`transformPoint`
  rotation branch stays unused (raster-only).

## ADR-2: job.rotation = 90, transformPoint stays unrotated
- **Context:** C sets `job->rotation = 90` (drives the transform + dim swap), but
  the port's `transformPoint` would `applyRotation` on `job.rotation !== 0`,
  double-rotating inner coords.
- **Decision:** set `job.rotation = 90` for landscape; make `transformPoint`
  not apply rotation (document: SVG rotation is group-transform-only; the ptf
  rotation branch is the raster/imagemap path, currently dead).
- **Consequences:** faithful to C's field; one contained guard; no double
  rotation.

## ADR-3: Derive single-page rotated translate
- **Context:** C's `setup_page` rotation translation depends on
  clip/canvasBox/pagination the port does not model; the port uses a simplified
  single-page viewport.
- **Decision:** derive the rotated translate from `bb` + pad + `rotate(-90)`
  geometry; validate against b68 native (`translate(-634 208.5)`).
- **Consequences:** consistent with the port's existing single-page model;
  canary-validated; full `setup_page` port deferred.

## ADR-4: Scope = rotation only
- **Context:** landscape graphs carry co-occurring unported features —
  `ratio=compress` (NaN), `page=` pagination + clusters (proc3d).
- **Decision:** implement rotation only; leave `Z` size-fit on un-swapped dims.
- **Consequences:** b68 (ratio=auto, Z=1) conforms to; NaN/proc3d improve but
  stay diverged on their separate blockers (out of scope, not regressions).
