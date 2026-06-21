<!-- SPDX-License-Identifier: EPL-2.0 -->
# T1 — rounded-path rendering: shared helper + cluster + Mrecord/record

## Context
graphviz-ts is a faithful TS port of C graphviz; `~/git/graphviz` is the spec.
Clusters with `style=rounded` and `shape=Mrecord` nodes render as sharp
`<polygon>` where C emits a rounded `<path>`. The rounded-bezier logic already
exists for poly nodes (`roundedDraw` in `src/common/poly-shapes.ts`); wire it
into the cluster boundary and the record box. Rendering-only — geometry is
invariant (AD-4).

## Task
1. **Extract shared helper** (`src/common/poly-shapes.ts`, AD-1/AD-5): pull the
   rounded-bezier core out of `roundedDraw` into a reusable exported function
   that takes absolute corner points + `renderer` + `job` + `filled` and emits
   the rounded `<path>` via `renderer.bezier` (reusing `interpolationPoints(...,
   true)`). Refactor `roundedDraw` to call it; poly-node output must stay
   byte-identical.
2. **Wire cluster** (`src/gvc/device.ts`, AD-2): in `renderOneCluster`, when the
   cluster `style` flags include `rounded`, call the helper with the four
   transformed bb corners and the resolved `filled` instead of
   `renderer.polygon(...)`. Otherwise unchanged.
3. **Wire record/Mrecord** (`src/common/record.ts`, AD-3): in `recordGencode`,
   port C's branch — resolve style, force `rounded` when the node shape is
   `Mrecord` (detect via `n.info.shape`); if `SPECIAL_CORNERS(style)` emit the
   helper's rounded path for the four outer-box corners, else keep `polygon`.
   Leave `genFields` (field dividers) unchanged.
4. Add/extend unit tests in the modules' existing `*.test.ts` (check
   `src/common/poly-shapes.test.ts`, `src/gvc/device.test.ts` /
   `src/render/svg-cluster-fill.test.ts`, and `src/common/record-port.test.ts`
   first — add, don't duplicate; there is no `record.test.ts`).
5. Keep helpers ≤ CCN 10, files ≤ 500 lines (decompose if the hook fires).

## Write-set
- `src/common/poly-shapes.ts`
- `src/gvc/device.ts`
- `src/common/record.ts`
- the modules' existing test file(s)

## Read-set
- `~/git/graphviz/lib/common/shapes.c` — `record_gencode` (Mrecord →
  `style.rounded`; `SPECIAL_CORNERS` → `round_corners(job, AF, 4, style,
  filled)`), `round_corners`, `SPECIAL_CORNERS` (`:213`)
- `~/git/graphviz/lib/common/emit.c` — emit_clusters rounded boundary branch
- `src/common/poly-shapes.ts:108-137` (`drawRoundCorners`, `roundedDraw`,
  `interpolationPoints`/`renderShapeBezier` usage)
- `src/gvc/device.ts:300-340` (`renderOneCluster` box draw)
- `src/gvc/device-cluster.ts` (`parseStyleFlags`, `applyClusterObjState`,
  `renderClusterLabel`)
- `src/common/record.ts:453-475` (`recordGencode` outer box) and
  `src/common/record-port.test.ts` (existing record test home)
- decisions.md#ad-1 … #ad-5

## Architecture decisions (locked)
AD-1 one shared rounded-box emitter (extract roundedDraw core). AD-2 cluster
rounded path when style.rounded. AD-3 record SPECIAL_CORNERS branch, Mrecord
forces rounded. AD-4 rendering-only, geometry invariant. AD-5 reuse
interpolationPoints/bezier; match C constants.

## Acceptance criteria
- AC1: Given `subgraph cluster_0{style=rounded;a}`, when rendered, then the
  cluster boundary is a `<path>` (not `<polygon>`) and byte-matches the oracle.
- AC2: Given `subgraph cluster_0{style="rounded,filled";fillcolor=grey95;a}`,
  when rendered, then one filled rounded `<path fill="grey95">` boundary,
  byte-matching the oracle.
- AC3: Given `a [shape=Mrecord, label="x|y"]`, when rendered, then the outer box
  is a rounded `<path>` byte-matching the oracle; the field divider polyline is
  unchanged.
- AC4: Given a plain `subgraph cluster_0{a}` and `a [shape=record,label="x|y"]`
  (no rounded), when rendered, then both still emit `<polygon>` (no regression).
- AC5: Given `a [shape=box, style=rounded]` (the existing control), when
  rendered, then its `<path>` output is byte-identical to pre-mission (the
  helper extraction did not change poly-node rendering).

## Observability
N/A — no new observable operations.

## Rollback
Reversible (decisions.md#rollback). In-memory render only; no migration.

## Quality bar
`npx vitest run` green; `npx tsc --noEmit` clean; complexity hook clean. One
commit: `feat(render): draw rounded clusters and Mrecord as bezier paths (round_corners)`.
