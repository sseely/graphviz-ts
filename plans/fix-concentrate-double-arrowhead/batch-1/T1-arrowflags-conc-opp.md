<!-- SPDX-License-Identifier: EPL-2.0 -->

# T1 — Port conc_opp_flag branch into arrowFlags

## Context
graphviz-ts is a faithful TS port of C Graphviz; the C source is the spec. Edge
arrowheads are computed in `SplineClipHelper.arrowFlags` and consumed by the
spline-clip path, which both emits the arrowhead polygon and clips the spline end
back to the arrow base. Under `concentrate=true`, `classify.ts` merges an
anti-parallel pair into one surviving edge and sets `conc_opp_flag` on it; that
flag is currently ignored, so the merged edge is drawn with only one arrowhead and
an unclipped opposite end.

## Task
Implement ADR-1/ADR-2/ADR-3 from `decisions.md`:
1. In `arrowFlags` (src/common/splines-clip.ts:73-84), after the existing
   dir + `arrowhead`/`arrowtail` `none` overrides and **before** returning, add:
   if `e.info.conc_opp_flag`, find the opposing original edge
   `f = e.head.outEdges(e.head.root).find(x => x.head === e.tail)`; if found,
   `const [s0, e0] = SplineClipHelper.arrowFlags(f); eflag |= s0; sflag |= e0;`.
2. Remove the stale "conc_opp_flag merging is not ported" sentence from the
   JSDoc; replace with a one-line `@see lib/common/arrows.c:arrow_flags` note.
3. TDD goldens (do these FIRST, watch them fail, then implement):
   - Add `graphs/b135.gv` (and `167.dot`) to `test/golden/inputs/`.
   - Generate refs with the **headless** oracle (ADR-4):
     `GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg <input> > test/golden/refs/<id>.svg`
     (run `sh test/corpus/gen-headless-gvbindir.sh` first if `/tmp/ghl` is stale).
   - Add manifest.json entries (`id`, `engine:"dot"`, `toleranceClass:"deterministic"`,
     `input`, `reference`, `description`). Follow an existing concentrate-free entry
     as the template.
4. Optional unit test `src/common/splines-clip.test.ts`: construct (or load via
   `parse`+layout) the `b135` graph and assert `arrowFlags` on the surviving
   `A->B` edge returns `[ARR_NORM, ARR_NORM]`. Prefer the golden if a direct unit
   harness is too heavy — do not over-build.

## Write-set
- `src/common/splines-clip.ts` (modify `arrowFlags`)
- `src/common/splines-clip.test.ts` (create, optional but preferred)
- `test/golden/manifest.json` (add b135, 167)
- `test/golden/inputs/<b135,167 input files>` (create)
- `test/golden/refs/<b135,167 ref svgs>` (create, from headless oracle)

## Read-set
- `src/common/splines-clip.ts:59-159` — `arrowFlags`, `resolveArrowFlags`,
  `arrowStartClip`/`arrowEndClip` (confirm sflag drives start clip).
- `src/layout/dot/classify.ts:352-370` — where `conc_opp_flag` is set.
- `src/model/node.ts:97` — `outEdges(g)` semantics (sorted, self-loops included).
- `decisions.md` (ADR-1..4)
- `lib/common/arrows.c:arrow_flags` in the C repo (`~/git/graphviz`) — the spec.

## Interface contract
`arrowFlags(e: Edge): [sflag: number, eflag: number]` — unchanged signature.
New behavior only when `e.info.conc_opp_flag === true`. Domain: `0|1`.

## Acceptance criteria (Given/When/Then)
- Given `digraph{concentrate=true; A->B; B->A}`, when rendered to SVG, then the
  merged edge emits **two** black arrowhead polygons (one at each node boundary),
  matching the headless oracle for `graphs-b135` conformant.
- Given the same graph, when the edge spline `@d` is compared, then it is clipped
  at **both** ends (no unclipped tail overrun) — `b135` path matches the oracle.
- Given any edge with `conc_opp_flag` unset, when `arrowFlags` runs, then the
  returned flags are identical to pre-change (no regression for non-concentrate
  inputs).
- Given `npm test`, when the golden suite runs, then the new `b135` entry passes
  at deterministic tolerance and no previously-green golden fails.

## Observability
N/A — no new observable runtime operations (layout/render library code).

## Rollback
Reversible — revert the commit; no migration.

## Quality bar
`npm run typecheck` exit 0; `npm test` exit 0. Keep the diff minimal and within
the write-set. Return only the structured result — no preamble.

## Commit
`fix(T1): emit both arrowheads for concentrated opposing edges`
Body: reference lib/common/arrows.c arrow_flags conc_opp_flag branch; note the
spline-clip side effect.
