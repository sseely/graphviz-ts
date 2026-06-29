# T1 — Fix `ordering=out`/`in` enforcement at the pinned site

## Context

Port of C Graphviz; C is the spec. T0 (Batch 0) pinned the first divergence in
the `ordering` enforcement chain (see `test/diagnostic/ordering-trace.md`). The
port currently produces the wrong in-rank order for `ordering` graphs (b58: places
4 left of 5; C places 5 left of 4 per `7->5` then `7->4`).

## Task

Implement the faithful fix at the site T0 pinned, matching the C reference
(`mincross.c` `do_ordering_node`/`ordered_edges`, and the FLATORDER/preservation
path). Two shapes, per T0:
- **Construction** (`mincross-build.ts`): correct `doOrderingNode` /
  `doOrderingAddFlatEdges` so the constraint edges / order match C exactly.
- **Preservation** (`mincross-order.ts`): if the constraints are correct but
  median/transpose drop them, make the passes respect the ordering constraint
  (mirror how C's `transpose`/`mincross_step` honor FLATORDER).

Add co-located unit tests pinning `ordering=out` and `ordering=in` in-rank order
to the C oracle values (use b58's known x-order; add a minimal `=in` case).

## Write-set (final = per T0)

- `src/layout/dot/mincross-build.ts` AND/OR `src/layout/dot/mincross-order.ts`
- the matching co-located `*.test.ts`

Do not touch other files. If the fix appears to need a file outside this set →
STOP (stop-condition 3).

## Read-set

- `test/diagnostic/ordering-trace.md` (the pinned divergence — read first)
- `decisions.md#ad-2`, `#ad-3`, `#ad-4`, `#key-c-references`
- the pinned function(s) in `mincross-build.ts` / `mincross-order.ts`
- `~/git/graphviz/lib/dotgen/mincross.c:432-540` and the relevant pass

## Architecture decisions (locked)

- AD-2 write-set = the pinned file(s) only. AD-3 no byte-match regression. AD-4
  fix `out` and `in`; per-node `ordering` only if same root cause.

## Acceptance criteria

- Given `graphs/b58.gv`, when rendered by the port, then each node's `<text>` x
  equals C: `{1:27,6:45,3:81,2:99,8:117,5:171,7:207,4:243}`.
- Given `linux.x86/ordering_dot1.gv`, when rendered, then in-rank node order
  matches C (no swapped pair).
- Given an `ordering=out` unit graph (b58-shaped) and an `ordering=in` unit graph,
  when laid out, then in-rank order matches the C oracle (pinned in the test).
- Given the full survey, when the gate runs, then GATE PASS with **0 regressions**
  (the 12 byte-matching `ordering` graphs stay byte-match).
- Given `npx tsc --noEmit` and `npx vitest run`, then both exit 0.

## Observability / Rollback

N/A — offline layout. Reversible (revert commit). On any byte-match→worse: revert
this change (AD-3) and record in the decision journal.

## Quality bar

Run tsc + vitest, then the full survey gate before committing. One commit:
`fix(T1): …`. If 3 consecutive edits to the same site don't resolve it → STOP
(stop-condition 4).

## Boundaries

- **Always**: keep the change faithful to the C reference; full-survey-gate before
  commit.
- **Ask first**: nothing (autonomous within the write-set).
- **Never**: optimize/refactor mincross beyond the pinned fix; expand the
  write-set; accept any byte-match regression.
