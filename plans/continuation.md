# Continuation Plan: dot-cluster golden test fix

## Status — COMPLETED (commit 517881f)

The `dot-cluster` golden test now passes. All previously-passing dot golden
tests continue to pass. Pre-existing failures (`dot-record-node`, `dot-html-label`,
`dot-nested-cluster`) remain and are unrelated to this work.

---

## Original status (for reference)

The `dot-cluster` golden test was failing:

```
Error: [dot-cluster] SVG mismatch at svg/g[1][childCount]
  actual: 13, expected: 15  (structural mismatch)
```

The y-coordinate shift (8pt offset on all node cy values) was fixed in the previous
session by changing `setYcoordsInitial` to use `g.info.ht1` instead of
`rankArr[maxR].ht1` as the initial y anchor.

Two issues remain:

1. **Missing cluster boundary polygons and labels** — the main render pipeline
   (`renderSvg → render → renderGraph` in `device.ts`) never renders clusters.
   The cluster rendering code in `emit-cluster.ts` uses the NEW `Renderer`
   interface (`emit-types.ts`) which is a separate pipeline that is never called
   by `renderSvg`. The OLD pipeline (`RendererPlugin` in `context.ts`) has no
   cluster hooks.

2. **`place_graph_label` not ported** — cluster label positions (`label.pos`) are
   never set because `place_graph_label` from `lib/common/postproc.c` has not been
   ported to TypeScript.

---

## Root-cause analysis

### Why clusters are missing (13 vs 15 children)

`renderSvg` calls `render()` in `device.ts`, which calls `renderGraph`, which calls:
```
beginGraph → walkNodesAndEdges → endGraph
```

`walkNodesAndEdges` only iterates `g.nodes`, never clusters. The cluster rendering
in `emitClusters` (`emit-cluster.ts`) uses `emit-types.ts::RenderJob` with a
`Renderer` interface that has `beginCluster`/`endCluster`, but this path is never
entered from `renderSvg`.

### Why cluster labels would be mispositioned even if clusters appeared

`placeGraphLabel` in C (`lib/common/postproc.c:734`) computes `label.pos` for each
cluster after bounding boxes are set. This function is not ported, so `label.set`
is always `false` and no text would be emitted.

### Correct polygon corner ordering

C's `gvrender_box` (`lib/gvc/gvrender.c:565`) constructs the 4 corners in this order:
```
A[0] = (ll.x, ll.y)   ← bottom-left (y-up space)
A[1] = (ll.x, ur.y)   ← top-left
A[2] = (ur.x, ur.y)   ← top-right
A[3] = (ur.x, ll.y)   ← bottom-right
```

After `devscale.y = -1` transformation these become SVG coordinates matching the
reference polygon `8,-236.5 8,-457 78,-457 78,-236.5`. The `boxCorners` function in
`emit-cluster.ts` uses a different (CW) order — that code is in the unused NEW
pipeline so it doesn't need to be fixed for this test, but it is wrong.

### Cluster label position math (verified against reference)

For a LABEL_AT_TOP cluster with label dimen.y = 16.5, fontsize = 14, GAP = 4:
```
border[TOP_IX].y = dimen.y + 2*GAP = 24.5
p.y = bb.ur.y - border[TOP_IX].y / 2 = bb.ur.y - 12.25
py  = p.y + dimen.y/2 - fontsize = bb.ur.y - 12.25 + 8.25 - 14 = bb.ur.y - 18
SVG y = -(py + yoffset_centerline) = -(bb.ur.y - 18 + 0.7) = -(bb.ur.y - 17.3)
```

Verified:
- cluster_0: bb.ur.y=457 → SVG y = -439.7 ✓ (reference: -439.7)
- cluster_1: bb.ur.y=228.5 → SVG y = -211.2 ✓ (reference: -211.2)

---

## Changes required

### File 1: `src/layout/dot/position-bbox.ts`

Add `placeGraphLabel` — port of `lib/common/postproc.c:place_graph_label` and
`place_flip_graph_label`:

```typescript
import type { TextlabelT } from '../../common/types.js';

/**
 * Set cluster label positions after bounding boxes are computed.
 * Non-flip case: TOP/BOTTOM placement.
 * @see lib/common/postproc.c:place_graph_label
 */
export function placeGraphLabel(g: Graph): void {
  if (g !== g.root) {
    const lab = g.info.label as TextlabelT | undefined;
    if (lab && !lab.set) {
      const bb = g.info.bb!;
      const flip = g.root.info.flip ?? false;
      const labelPos = g.info.label_pos ?? 1;
      let d = { x: 0, y: 0 };
      const p = { x: 0, y: 0 };

      if (!flip) {
        // place_graph_label (non-flip)
        if (labelPos & 1) {          // LABEL_AT_TOP
          d = g.info.border?.[TOP_IX] ?? d;
          p.y = bb.ur.y - d.y / 2;
        } else {                     // LABEL_AT_BOTTOM
          d = g.info.border?.[BOTTOM_IX] ?? d;
          p.y = bb.ll.y + d.y / 2;
        }
        if (labelPos & 4) {          // LABEL_AT_RIGHT
          p.x = bb.ur.x - d.x / 2;
        } else if (labelPos & 2) {   // LABEL_AT_LEFT
          p.x = bb.ll.x + d.x / 2;
        } else {
          p.x = (bb.ll.x + bb.ur.x) / 2;
        }
      } else {
        // place_flip_graph_label
        if (labelPos & 1) {          // LABEL_AT_TOP → RIGHT_IX when flipped
          d = g.info.border?.[RIGHT_IX] ?? d;
          p.x = bb.ur.x - d.x / 2;
        } else {                     // LABEL_AT_BOTTOM → LEFT_IX when flipped
          d = g.info.border?.[LEFT_IX] ?? d;
          p.x = bb.ll.x + d.x / 2;
        }
        if (labelPos & 4) {          // LABEL_AT_RIGHT → bottom
          p.y = bb.ll.y + d.y / 2;
        } else if (labelPos & 2) {   // LABEL_AT_LEFT → top
          p.y = bb.ur.y - d.y / 2;
        } else {
          p.y = (bb.ll.y + bb.ur.y) / 2;
        }
      }
      lab.pos = p;
      lab.set = true;
    }
  }
  // Recurse into sub-clusters (C clust[] is 1-indexed; TypeScript is 0-indexed)
  const nClust = g.info.n_cluster ?? 0;
  for (let c = 0; c < nClust; c++) {
    placeGraphLabel(g.info.clust![c]);
  }
}
```

Key imports to add (already available in the file or nearby):
- `TOP_IX`, `BOTTOM_IX`, `LEFT_IX`, `RIGHT_IX` from `./position-aux.js`
- `TextlabelT` from `../../common/types.js`

### File 2: `src/layout/dot/position.ts`

Call `placeGraphLabel` after `setAspect(g)` in `dotPosition`:

```typescript
import { setAspect, placeGraphLabel } from './position-bbox.js';
...
  setAspect(g);
  placeGraphLabel(g);   // ← add this line
  /* remove_aux_edges must come after set_aspect */
  removeAuxEdges(g);
```

### File 3: `src/gvc/context.ts`

Add optional `beginCluster` / `endCluster` to `RendererPlugin`:

```typescript
export interface RendererPlugin {
  ...
  endLabel?(job: RenderJob): void;
  beginCluster?(sg: Graph, job: RenderJob): void;   // ← add
  endCluster?(sg: Graph, job: RenderJob): void;     // ← add
}
```

### File 4: `src/gvc/job.ts`

Add `clusterId` counter (alongside `nodeId` and `edgeId`):

```typescript
nodeId: number = 0;
edgeId: number = 0;
clusterId: number = 0;   // ← add
```

### File 5: `src/render/svg-helpers.ts`

Add two new exported functions (after `svgEndEdge`):

```typescript
export function svgBeginCluster(sg: Graph, job: RenderJob): void {
  job.clusterId++;
  job.write('<g id="clust' + job.clusterId + '" class="cluster">\n');
  job.write('<title>' + escapeXml(sg.name) + '</title>\n');
}

export function svgEndCluster(job: RenderJob): void {
  job.write('</g>\n');
}
```

Note: `clusterId` must exist on `RenderJob` (File 4 above). `escapeXml` is already
defined in this file.

### File 6: `src/render/svg.ts`

Import and wire up the two new helpers in `SvgRenderer`:

```typescript
import {
  ...
  svgBeginCluster,
  svgEndCluster,
} from './svg-helpers.js';

// Inside SvgRenderer:
beginCluster(sg: Graph, job: RenderJob): void { svgBeginCluster(sg, job); }
endCluster(_sg: Graph, job: RenderJob): void { svgEndCluster(job); }
```

### File 7: `src/gvc/device.ts`

Add `renderClusters` and call it from `renderGraph`. The label rendering mirrors
`poly-gencode.ts::renderLabel` exactly (center-valign formula, same as nodes).

Add imports:
```typescript
import type { TextSpan } from '../common/emit-types.js';
import type { TextlabelT } from '../common/types.js';
// TextlabelT can be added to the existing ShapeDesc import line from types.js
```

Add function (before `renderGraph`):
```typescript
/**
 * Render cluster boundary polygons and labels, depth-first.
 * Corner order matches C's gvrender_box: LL, (LL.x,UR.y), UR, (UR.x,LL.y).
 * @see lib/gvc/gvrender.c:gvrender_box
 * @see lib/common/emit.c:emit_clusters
 */
export function renderClusters(g: Graph, renderer: RendererPlugin, job: RenderJob): void {
  const nClust = g.info.n_cluster ?? 0;
  const clust = g.info.clust;
  if (nClust === 0 || !clust) return;
  for (let c = 0; c < nClust; c++) {
    const sg = clust[c];
    if (!sg) continue;
    renderClusters(sg, renderer, job);  // sub-clusters first
    renderer.beginCluster?.(sg, job);
    // Box polygon — gvrender_box corner order
    const bb = sg.info.bb!;
    const rawPts = [
      { x: bb.ll.x, y: bb.ll.y },
      { x: bb.ll.x, y: bb.ur.y },
      { x: bb.ur.x, y: bb.ur.y },
      { x: bb.ur.x, y: bb.ll.y },
    ];
    renderer.polygon(rawPts.map(p => transformPoint(p, job)), false, job);
    // Label — center-valign, same formula as poly-gencode.ts:renderLabel
    const lab = sg.info.label as TextlabelT | undefined;
    if (lab?.set && lab.u.kind === 'txt' && lab.u.nspans > 0) {
      const py = lab.pos.y + lab.dimen.y / 2.0 - lab.fontsize;
      for (let i = 0; i < lab.u.nspans; i++) {
        const span = lab.u.span[i] as TextSpan | undefined;
        if (!span) break;
        renderer.textspan({ x: lab.pos.x, y: py }, span, job);
      }
    }
    renderer.endCluster?.(sg, job);
  }
}
```

Modify `renderGraph` to call `renderClusters` before nodes/edges:

```typescript
export function renderGraph(g: Graph, job: RenderJob, renderer: RendererPlugin): string {
  renderer.beginGraph(g, job);
  renderClusters(g, renderer, job);   // ← add this line
  walkNodesAndEdges(g, renderer, job);
  renderer.endGraph(g, job);
  return job.output.join('');
}
```

---

## Expected result after all changes

The `dot-cluster` test SVG structure will have 15 children in `g[1]`:
1. Background polygon (already present)
2. `<g id="clust1" class="cluster">` for `cluster_0` with polygon + label text
3. `<g id="clust2" class="cluster">` for `cluster_1` with polygon + label text
4–9. Six node `<g>` elements (A, B, C, D, E, F)
10–14. Five edge `<g>` elements

All polygon points and text positions verified against reference SVG arithmetic
(see analysis above). The test should pass with zero numeric mismatches, not just
the structural count.

---

## Pre-existing failing tests (not this task)

These were failing before this session and are unrelated:

- `twopi` — hub placed at (68.9, 0) instead of (0, 0)
- `circo` — ring radius 17.645 vs 17.597

---

## Quality gates to run after changes

```bash
cd /Users/scottseely/git/graphviz-ts
npx tsc --noEmit
npx vitest run test/golden/dot-cluster.test.ts
npx vitest run
```

All three must pass (zero TypeScript errors, dot-cluster golden passes, full suite
green).
