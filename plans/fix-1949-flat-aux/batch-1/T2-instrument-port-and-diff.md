# T2 — Instrument the port's aux pipeline and pin the divergence

## Context
With C's aux-graph dump from T1 in hand, dump the same fields from the port's
`makeFlatAdjEdges` (`src/layout/dot/splines-flat.ts:289`) and find the first
field that diverges. Prime suspect: `buildFlatAux` omits C's rank=source pin
on `auxt`; secondary: aux `dotSameports`/`dotSplines_` curl. Do NOT change
production behavior — instrumentation only.

## Task
1. Add temp `console.error` (guarded by `process.env.DBG1949`) inside
   `makeFlatAdjEdges` dumping the same shape as T1: each aux node's
   source-name/rank/order/coord (before + after `repositionFlatAux`), each aux
   edge's tail/head + resolved tail/head port `.side`/`.p`, and each aux
   edge's spline size + control points after `dotSplines_`, plus `del`+`flip`.
2. Run `DBG1949=1 npx tsx test/corpus/render-one.ts
   ~/git/graphviz/tests/1949.dot dot >/dev/null` and capture.
3. Diff port dump vs T1's C dump field-by-field in document order. Identify
   the FIRST divergence (aux node coord? port side/p? spline size? control
   point?).
4. If the first divergence is `auxt`'s aux position and C pins it via
   rank=source while the port doesn't → cause confirmed (AD-2 applies). If the
   aux coords match but the spline/ports differ → cause is in
   sameports/splines (STOP per AD-3, since the fix might need `sameport.ts`).
5. Write the diagnosis artifact (mechanism / origin `file:line` / causal chain
   / ruled-out) to `.agent-notes/1949-diagnosis.md` and `decision-journal.md`.
6. Revert BOTH the port instrumentation and (with T1) the C instrumentation.

## Write-set
- None committed. Temp instrumentation in `src/layout/dot/splines-flat.ts`,
  reverted at end. Diagnosis prose appended to
  `.agent-notes/1949-diagnosis.md` + `decision-journal.md` (these MAY be
  committed as docs).

## Read-set
- `src/layout/dot/splines-flat.ts:127-307` (cloneFlatEdge, buildFlatAux,
  repositionFlatAux, copyFlatSplines, makeFlatAdjEdges)
- T1 output in `decision-journal.md`
- `~/git/graphviz/lib/dotgen/dotsplines.c:1165-1180` (subg rank=source)
- `plans/fix-1949-flat-aux/decisions.md#ad-2`

## Interface contract (consumed by T3)
`{ firstDivergentField, portValue, cValue, mechanism, originFileLine,
fixLocus }` where `fixLocus` is the specific function in `splines-flat.ts` to
change (or "STOP — needs sameport.ts").

## Acceptance criteria
- Given both dumps, when diffed, then the first divergent field is named
  precisely (not "the spline looks wrong").
- Given the divergence, then the mechanism is stated with a C `file:line`
  origin and what was ruled out.
- Given AD-2 is inert (rank=source doesn't move auxt in the 2-node aux), then
  T2 records that and continues hunting rather than forcing a rank=source edit.
- Given completion, then `git -C ~/git/graphviz status` and `git status
  src/layout/dot/splines-flat.ts` are both clean (instrumentation reverted).

## Observability
N/A.

## Rollback
Reversible — instrumentation only.

## Quality bar
`npx tsc --noEmit` clean after reverting instrumentation. No production
behavior change in this task.
