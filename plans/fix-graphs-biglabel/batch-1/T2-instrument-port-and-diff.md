# T2 — instrument port, diff, produce root cause

## Context

With T1's oracle dump in hand, instrument the PORT at the same points along the
edge-spline pipeline for `struct1:f2→struct3:here` and diff to find where port
geometry FIRST departs from C. The port render path is
`test/corpus/render-one.ts <biglabel.gv> dot` (same entry the survey uses; run
with `GVBINDIR=/tmp/ghl` and the npx-cached tsx per decisions.md AD-1). The
divergence is a piece-count/shape difference (1 vs 2 cubics) with a matching
start point — so the split is between box-corridor construction, the
input polyline, and the Proutespline fit. Isolate ONE origin.

## Task

1. Add temporary instrumentation (gated logging; remove before Batch 2) to the
   port spline pipeline to dump, for this edge: the box corridor, the
   Proutespline input polyline + slopes, and the output beziers.
2. Align each port value to the T1 oracle value; find the FIRST that differs.
3. Produce the root-cause artifact per `diagnosis.md`: **mechanism** (1–2
   sentences), **origin** (`file:line`), **causal chain** (why the 1-vs-2-cubic
   symptom follows), **ruled out** (what you eliminated + evidence).
4. Name the exact `fixSite` (file + function) for T3.
5. If the first divergence is oracle-side or reduces to platform-libm FP only,
   invoke the **AD-5 escape**: stop, recommend accepted-divergence, and specify
   the comparison-page artifact needed.

## Write-set
- `.agent-notes/graphs-biglabel-rootcause.md` (create)
- `plans/fix-graphs-biglabel/decision-journal.md` (append)
- temporary instrumentation in `src/**` MUST be reverted before batch end
  (verify `git diff --name-only src/` is empty at completion).

## Read-set
- `.agent-notes/graphs-biglabel-oracle-dump.md` (T1 output)
- `src/layout/dot/edge-route-boxes.ts`, `edge-route-chain.ts`,
  `edge-route-faithful.ts`
- `src/common/splines-routespl.ts`, `splines-path-end.ts`,
  `splines-path-begin.ts`
- memory `long-edge-undersegment-done`, `edge-routing-order-done`,
  `faithful-corridor-minw-per-rank`, `active-fitter-no-loop-corridors`

## Architecture decisions (locked)
- AD-2 (fix at origin), AD-5 (not-a-port-bug escape).

## Interface contract (consumed by T3)

```
{ mechanism: string,
  originFile: string, originLine: number,
  causalChain: string, ruledOut: string,
  fixSite: { file: string, symbol: string },
  verdictTarget: "conformant" | "structural-match" }  // per AD-3
```

## Acceptance criteria
- Given the port instrumented at the same points, when rendered, then its
  boxes/spline for the edge are captured.
- Given oracle vs port dumps diffed, then the FIRST divergence is a single
  `file:line` origin with a stated mechanism (not a list of symptom sites).
- Given the origin implicates platform-libm FP only, then the AD-5 escape fires
  and the mission stops before Batch 2.
- Given completion, when `git diff --name-only src/` is run, then it is empty
  (all temporary instrumentation reverted).

## Observability
N/A — dev/test instrumentation.

## Rollback
Reversible — delete the note; revert instrumentation.

## Quality bar
A single origin `file:line` + mechanism, OR a substantiated AD-5 stop. Temporary
`src/` instrumentation fully reverted. Return only the structured result.

## Commit
`docs(T2): root-cause graphs-biglabel edge-spline divergence`
(no `src/` change committed — instrumentation reverted)
