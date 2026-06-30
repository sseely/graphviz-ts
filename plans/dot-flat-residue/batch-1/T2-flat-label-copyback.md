# T2 — DOT-10: copy flat-edge label position back from aux graph

## Context

Port-bearing adjacent labeled flats route via the rotated aux graph
(`makeFlatAdjEdges` → `copyFlatSplines` → `copyOneFlatSpline` in
`splines-flat.ts`). `copyOneFlatSpline` transforms splines and arrowheads
back onto the original edge but **not** the label, so the label is
dropped. C copies it (`dotsplines.c:1273-1277`).

## Task

**Step 1 — feasibility spike (do this first).** Add a temporary probe (or
a unit test) that runs `makeFlatAdjEdges` on
`{rank=same a b} a:e->b:w [label="x"]` and asserts the aux edge
(`aux.alg.get(orig)`) ends with `info.label?.set === true` and a finite
`info.label.pos`. If it is **not** set, STOP and reassess `cloneFlatEdge`
(the label object is not deep-cloned by `cloneEdge`; the aux graph must
rebuild+position it). Record the spike result in `decision-journal.md`.

**Step 2 — copy-back.** In `copyOneFlatSpline`, after the spline copy,
when `orig.info.label` is set:
- `orig.info.label.pos = transformf(auxe.info.label.pos, del, flip)`
- `orig.info.label.set = true`
- grow the graph bb via `updateBB(g, orig.info.label)`.

`updateBB` is currently private in `splines-label.ts:288` — add `export`
and import it. Thread the graph (or its bb) into `copyOneFlatSpline` as
needed (it already receives `bb`; pass `g`/label-bb consistently, keeping
the signature <=5 params — bundle into the existing args or a small
struct if it would exceed 5).

## Write-set

- `src/layout/dot/splines-flat.ts`
- `src/layout/dot/splines-label.ts` (export `updateBB`)
- `src/layout/dot/splines-flat.test.ts` (create if absent)

## Read-set

- `src/layout/dot/splines-flat.ts:199-260` (copyOneFlatSpline,
  copyFlatSplines, makeFlatAdjEdges)
- `src/layout/dot/splines-label.ts:288-300` (updateBB)
- `~/git/graphviz/lib/dotgen/dotsplines.c:1244-1281`
- `decisions.md#ad-3`

## Architecture decisions

AD-3 (reuse aux label pos + existing updateBB; spike first). Locked.

## Acceptance criteria

- Given `{rank=same a b} a:e->b:w [label="x"]`, when routed, then
  `e.info.label.set === true` and `e.info.label.pos` equals the
  C-oracle position (within byte-format tolerance) — oracle pin.
- Given the same graph, when rendered, then the graph bb includes the
  label box.
- Given `npx vitest run`, then pass count >= 1852, zero regressions, all
  unrelated goldens conformant.

## Observability

N/A.

## Rollback

Reversible — revert the task commit. No migration.

## Comparison page

Create `comparisons/dot-10-ported-labeled-flat.md`: DOT input, oracle
label position + edge path, port output, byte-diff verdict. Reference it
in `decision-journal.md`. Not done without it.

## Commit

`feat(T2): copy flat-edge label position back from aux graph`
