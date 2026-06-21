<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: rounded `<path>` rendering for clusters + Mrecord

## Objective

Port C's rounded-corner rendering for two shape kinds that the port currently
draws as sharp `<polygon>` where C draws a rounded `<path>`: (1) subgraph
clusters with `style=rounded` (incl. `rounded,filled`), and (2) `shape=Mrecord`
nodes (and any record with `style=rounded`). Regular `style=rounded` box nodes
ALREADY round correctly via `drawRoundCorners`/`roundedDraw` in
`src/common/poly-shapes.ts` — the rounding logic exists; it is simply not wired
into the cluster boundary (`src/gvc/device.ts`) or the record box
(`src/common/record.ts`). This is a **rendering** fix: geometry (bbox, node and
cluster positions) is unchanged; only the boundary element changes from a sharp
rect polygon to a rounded-rect bezier path, matching the oracle.

## Root cause (already diagnosed)

- `digraph{subgraph cluster_0{style=rounded;a}}` → oracle `<path>`, port `<polygon>`.
- `digraph{a[shape=Mrecord,label="x|y"]}` → oracle `<path>`, port `<polygon>`.
- Control (already correct): `digraph{a[shape=box,style=rounded]}` → both `<path>`.
- C spec: `record_gencode` (`~/git/graphviz/lib/common/shapes.c`) does
  `if (Mrecord) style.rounded = true; if (SPECIAL_CORNERS(style)) round_corners(job, AF, 4, style, filled); else gvrender_box(...)`. Cluster rounding is
  emitted in `~/git/graphviz/lib/common/emit.c` (emit_clusters rounded branch).
- Draw sites in the port: cluster box `src/gvc/device.ts:329`
  (`renderer.polygon(...)`); record box `src/common/record.ts:473`
  (`job.renderer.polygon(...)`). Both build 4 corner points then draw a polygon.

## Branch

`fix/rounded-clusters-mrecord` off `main`. Merge with a **merge commit** (not
squash) per mission-brief convention.

## Key facts that make this tractable

- The rounded-bezier emitter already exists: `roundedDraw` in
  `src/common/poly-shapes.ts` (uses `interpolationPoints` + `renderShapeBezier`).
  It is private and coupled to the poly ring `ShapeCtx`; extract its core into a
  reusable helper over absolute corner points (AD-1).
- Cluster fill/pen obj state is already resolved (`applyClusterObjState` returns
  `filled`); the rounded path reuses it — only the draw call changes (AD-2).
- The rounded path is inscribed in the SAME bounding box as the sharp polygon —
  no layout/position change (AD-4). Cluster LAYOUT is explicitly out of scope.

## Constraints

See [decisions.md](decisions.md) for AD-1…AD-5 (all approved).

**STOP conditions:**
- A file outside the write-set needs changing.
- Any parity regression that is not strict re-bucketing to an equal-or-better
  verdict (0-regression rule; memory `bucket-fix-rebucketing`).
- The change perturbs layout — ANY node/cluster position or bbox changes
  (this is rendering-only; positions must be byte-identical).
- Same divergence approached 3× without resolving; or 2 consecutive gate
  failures on the same check.
- Any of AD-1…AD-5 would have to be contradicted.

**PUSH FORWARD on own judgment:** the exact corner-curve interpolation needed
to byte-match `round_corners`; golden graph choice + tolerance class
(`deterministic`) + corpus winner to pin; complexity-hook helper decomposition;
fixing pre-existing 1–3 line violations in edited files; where the extracted
helper lives within `poly-shapes.ts`.

## Quality gates

```
- command: npx vitest run            # pass: exit 0, all tests pass; on_fail: fix_and_rerun
- command: npx tsc --noEmit          # pass: exit 0; on_fail: fix_and_rerun
- command: npx tsx test/corpus/survey.ts && per-id delta check vs baseline
                                     # pass: 0 verdict regressions; on_fail: stop
- command: git diff --name-only HEAD~1 HEAD   # pass: only write-set files; on_fail: stop
```

Oracle for goldens: `~/git/graphviz/build/cmd/dot/dot` with
`GVBINDIR=/tmp/gvplugins` (dot 15.1.0). Baseline parity = a fresh
`test/corpus/survey.ts` snapshot at the branch point.

## Batches

| Batch | Tasks | Status |
|-------|-------|--------|
| [batch-1](batch-1/overview.md) | T1 shared rounded-box helper + wire cluster + wire Mrecord/record | [x] |
| [batch-2](batch-2/overview.md) | T2 golden + parity verification | [ ] |

## Index

- [decisions.md](decisions.md)
- [diagrams/data-flow.md](diagrams/data-flow.md)
- [diagrams/component-map.md](diagrams/component-map.md)
- [decision-journal.md](decision-journal.md)
