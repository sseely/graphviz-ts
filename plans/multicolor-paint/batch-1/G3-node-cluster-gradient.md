# G3 — wire node + cluster gradient fills (AD3, AD6)

## Context

graphviz-ts port; C at ~/git/graphviz/lib (15.0.0). Baseline 1584/0, 97
goldens. Hook rule: smallest fix, ≤2 attempts/file, then move on.

G1 added the discriminated `resolveNodeFill`/`resolveClusterFill` (kinds
none/solid/linear/radial) + findStopColor. G2 made `emitStyle` emit the
gradient `<defs>` + `url(#id)` when `job.obj.fill` is Linear/Radial and
added the gradId counters. This task SETS the gradient obj-state fields
at the node and cluster sites so gradients actually render. Today these
sites use the first-solid fallback (parity-render-styling).

## Task (TDD — failing tests first)

### 1. src/common/poly-gencode.ts — node gradient

Where the node fill is resolved and set on `job.obj` (the parity
`applyNodeStyle`/resolution helper), switch to G1's discriminated
`resolveNodeFill`:
- `kind:'none'` → fill None (unchanged).
- `kind:'solid'` → fill Solid + fillColor (unchanged).
- `kind:'linear'` → `obj.fill = FillType.Linear`, `obj.fillColor =
  {type:'string', s: fillColor}`, `obj.stopColor = {type:'string', s:
  stopColor}`, `obj.gradientFrac = frac`, `obj.gradientAngle = angle`.
- `kind:'radial'` → `FillType.Radial` + same fields.
Pass the node attrs incl. `gradientangle` (via nodeAttr). The `filled`
flag threaded to the FIRST periphery (G2/T3 mechanics) stays true for
gradient fills (C poly_gencode sets filled=GRADIENT/RGRADIENT, a truthy
fill flag). @see lib/common/shapes.c:poly_gencode (:2982-3000 GRADIENT/
RGRADIENT block). Inner peripheries stay unfilled.

### 2. src/gvc/device.ts — cluster gradient

In `renderOneCluster` / the cluster obj-state helper, switch to G1's
discriminated `resolveClusterFill` and set the same Linear/Radial fields
when the cluster fill is a gradient. @see lib/common/emit.c:emit_clusters
(:3857 findStopColor → GRADIENT/RGRADIENT block). The boundary polygon's
filled flag stays the resolved truthy value.

Keep all solid/none behavior byte-identical (the 97 goldens). Do NOT make
structural device.ts changes beyond the cluster fill obj-state lines.

## C ground truth (oracle-verify)

- `a [style=filled, fillcolor="red:blue"]` → `<defs><linearGradient
  id="node1_l_0" …>` (node has id "node1") + `<ellipse fill=
  "url(#node1_l_0)" …>`. NOTE: node/cluster gradients are prefixed with
  the object id (obj->id) — verify the exact prefix against the oracle.
- `subgraph cluster_0 { style=filled; fillcolor="red:blue"; a }` →
  cluster gradient `id="clust1_l_0"` (or whatever the oracle shows).
- `style="radial,filled"` → radial.
Capture each with `dot -Tsvg` and match byte-for-byte.

## Write-set (STRICT)

- src/common/poly-gencode.ts (+ its test)
- src/gvc/device.ts (cluster fill obj-state lines only) (+ its test)

If wiring needs files beyond these (e.g. emitStyle changes), STOP — that
is G2's territory; report instead.

## Read-set

- ~/git/graphviz/lib/common/shapes.c:poly_gencode (:2980-3060 GRADIENT/
  RGRADIENT/filled block), lib/common/emit.c:emit_clusters (:3850-3915
  gradient block)
- src/common/poly-gencode.ts (the node resolution/apply helper from the
  parity mission), src/gvc/device.ts (renderOneCluster /
  applyClusterObjState)
- src/common/style-resolve.ts (G1 discriminated resolvers), src/gvc/job.ts
  (ObjState gradient fields), src/gvc/context.ts (FillType), G1/G2 task
  files for the interface contracts

## Architecture decisions (locked)

AD3 (set obj-state; emitStyle emits — don't re-implement emission), AD6
(gradient when findStopColor true; radial when style=radial). One
obj-state stack; gradients are a fill kind on it.

## Acceptance criteria (oracle-verify each)

- node fillcolor="red:blue" → linear gradient defs + url, id-prefixed,
  matching C byte-for-byte.
- node style="radial,filled" fillcolor="red:blue" → radial.
- cluster fillcolor="red:blue" style=filled → cluster gradient.
- node fillcolor="red" (single) → solid, unchanged.
- UNSTYLED node/cluster → byte-identical to pre-task; 97 goldens stable.

## Byte-stability gate

```
OUTDIR=/tmp/g3-after npx tsx .probes/render-all.ts
diff -rq /tmp/mc-baseline /tmp/g3-after
```
no differences. tsc 0; vitest ≥ (post-G1/G2 count), 0 failed.

## Return (brief, structured)

- The exact obj-state fields set at the node and cluster sites.
- Oracle table: node-linear, node-radial, cluster-linear, node-solid-
  unchanged, unstyled-unchanged — PORT vs C Y/N (note the id prefix).
- tsc; vitest; byte-diff result.
