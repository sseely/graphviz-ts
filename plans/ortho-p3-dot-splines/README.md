# Mission: `splines=ortho` for the dot engine (ortho P3 — dot dispatch)

## Objective

Make `splines=ortho` render correctly under the **default `dot` engine** by
porting the `EDGETYPE_ORTHO` dispatch branch of `lib/dotgen/dotsplines.c`
(`dot_splines_`) to call the already-ported `orthoEdges` pipeline, and
validating the full ortho render against **native instrumented C**. This is the
final slice of DOT-8 (the only unported edge-routing feature). The ortho
foundation (`rawgraph`/`trapezoid`/`sgraph`/`fPQ`) is oracle-pinned (ortho-P1,
done) and the `orthoEdges`/`maze`/`partition` pipeline already exists and is
dispatched by **neato**; only the **dot** wiring + end-to-end C validation
remain.

## Carried-in facts (do NOT re-derive)

- `EDGETYPE_ORTHO=4` is parsed (`src/layout/dot/splines.ts:55,67`) but **never
  dispatched** by `dotSplines_` (splines.ts:397) — `splines=ortho` under dot
  currently falls through to regular spline routing (wrong, not a crash).
- The dot dispatch to port is `dotsplines.c:251-259` + the `finish:` block
  (`dotsplines.c:461-475`): `resetRW(g)` → `orthoEdges(g, useLbls)` → skip
  `routesplinesterm` → `State=GVSPLINES; EdgeLabelsDone=1; return`.
- **C does NOT route edges around edge labels.** `orthoEdges` itself
  (`ortho.c:1196-1199`) warns *"Orthogonal edges do not currently handle edge
  labels. Try using xlabels"* and downgrades `useLbls=false`. Faithful label
  "support" = position labels (`setEdgeLabelPos` ≈ existing
  `placeRegularEdgeLabels`) + dispatch `orthoEdges(g,true)`; edges still cross
  labels, exactly as native `dot`. **Do not invent a label-routing path C lacks.**
- Neato already wires ortho (`neato/splines.ts:330` via `OrthoHelper`) — a
  working reference. The dot adapter is **dot-local** (ADR-1).
- C-oracle = native `dot -Tsvg` (gvmine) for goldens; the P1 tiny-harness recipe
  (link prebuilt `libortho.a`, zero C-tree edits) for any maze/partition drill.
  See `[[ortho-p1-already-ported-fpq-invariant]]`, `[[oracle-native-not-wasm]]`.

## Depends on: ortho P2 (render-pipeline pinning)

**Run `plans/ortho-p2-render-pipeline` first.** P2 oracle-pins
`partition`/`maze`/`ortho-route` against native C, so by the time this mission
wires dot, the render pipeline is proven correct. With P2 green, T3 below is
**validation + golden minting**, not deep pipeline debugging — any residual
divergence should be dispatch/adapter-level (dot-specific coord/obstacle
handling), not maze/partition/route logic. If a golden diverges in a way that
implicates the pipeline, that's a P2 gap — STOP and fix it in P2, not here.

## Branch

`feature/ortho-p3-dot-splines` (new, off `main`, after P2 merges). The ortho-P1
work lives on `feature/ortho-p1-foundation`; do not entangle the PRs.

## Constraints

- **Faithful port.** Mirror `dotsplines.c` dispatch position + side-effect order
  exactly; preserve C function boundaries (ADR-5). Do not optimize Seidel/maze.
- **Behavior change is scoped to `splines=ortho`.** Any change to an existing
  **non-ortho** golden or test is a **STOP** (regression — see decisions ADR-4).
- **C source is sacred.** Revert any instrumentation;
  `git -C ~/git/graphviz status --porcelain lib/` must show no tracked `.c/.h`
  modification before any commit.
- **No label-routing invention.** If correctness seems to need routing edges
  around labels, STOP — C does not do it (carried-in fact above).

## Quality gates

```
- command: npm run typecheck                  # pass: exit 0
- command: npm test                           # pass: exit 0 (baseline + new ortho dot tests + new goldens)
- command: npm run build                      # pass: esbuild bundles
- command: git -C ~/git/graphviz status --porcelain lib/   # pass: no tracked .c/.h modification
- command: git diff --name-only HEAD~1        # pass: only src/layout/dot/**, src/ortho/**, test/golden/**, plans/**
```
Regression sub-gate: **no existing non-ortho `test/golden/refs/*.svg` changes.**

## Batches

| Batch | Goal | Status |
|-------|------|--------|
| [1](batch-1/overview.md) | T1 — dot ortho dispatch + dot-local adapter + `resetRW` (no labels) | [x] |
| [2](batch-2/overview.md) | T2 — edge-label positioning in the ortho branch (faithful warn+downgrade) | [x] |
| [3](batch-3/overview.md) | T3 — golden fixtures + native-C refs + end-to-end validation (pipeline pre-pinned by P2; dispatch/adapter fixes only) | [x] |

## Index

- [decisions.md](decisions.md) — ADR-1..ADR-5
- [batch-1/T1-dot-ortho-dispatch.md](batch-1/T1-dot-ortho-dispatch.md)
- [batch-2/T2-ortho-edge-labels.md](batch-2/T2-ortho-edge-labels.md)
- [batch-3/T3-ortho-goldens-validate.md](batch-3/T3-ortho-goldens-validate.md)
- [diagrams/data-flow.md](diagrams/data-flow.md), [diagrams/component-map.md](diagrams/component-map.md)
- [decision-journal.md](decision-journal.md) — appended during execution
- **C spec:** `~/git/graphviz/lib/dotgen/dotsplines.c` (dispatch),
  `~/git/graphviz/lib/ortho/ortho.c` (`orthoEdges`)
- **Oracle recipe:** `[[ortho-p1-already-ported-fpq-invariant]]`, `/tmp/gvmine`
