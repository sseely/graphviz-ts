# T2 — Instrument port; dump 4 stages; diff vs C; localize

## Context
T1 produced `oracle/c-dump.txt` — C's ground-truth x-coord NS trace for
honda-tokoro. Now instrument the port's equivalent and find the first stage that
diverges. Port x-coord pipeline: `setXcoords`/`createAuxEdges`/`makeAuxEdge`
(`src/layout/dot/position.ts`), aux constraints `make_LR_constraints`
(`position-aux.ts`), network simplex (`ns.ts`/`ns-core.ts`), balance `lrBalance`
(`ns.ts:311`). See [decisions.md](../decisions.md) ADR-2/ADR-4.

## Task
1. Add env-gated (`process.env.DBG_XNS`) stderr dumps to the port's x-coord NS at
   the same four points as T1: aux graph, pivot sequence, pre-balance x,
   post-balance x. Match the C dump's label format and node-name mapping.
2. Run the port on honda-tokoro → `oracle/port-dump.txt`.
3. Diff `c-dump.txt` vs `port-dump.txt` stage by stage. Identify the FIRST stage
   that differs:
   - Stage 1 (aux graph) differs → fix is in aux construction
     (`position.ts`/`position-aux.ts`/`classify.ts`).
   - Stage 2 (pivots) differs but stage 1 matches → fix is in NS pivot
     selection / feasible tree (`ns.ts`/`ns-core.ts`).
   - Stage 3 matches, stage 4 differs → fix is in `lrBalance`.
4. Also verify ADR-4: does the port's `setXcoords` control flow match
   `position.c:142-148` (the `connectGraph` + double-`rank` recovery)?
5. Record the localized site + evidence in `decision-journal.md` and a new
   `.agent-notes/xcoord-ns-degeneracy-localization.md`.

## Run
```
export PATH="$HOME/.npm/_npx/fd45a72a545557e9/node_modules/.bin:$PATH"
DBG_XNS=1 tsx test/corpus/render-one.ts ~/git/graphviz/tests/graphs/honda-tokoro.gv dot \
  >/dev/null 2>plans/xcoord-ns-degeneracy/oracle/port-dump.txt
diff plans/xcoord-ns-degeneracy/oracle/c-dump.txt plans/xcoord-ns-degeneracy/oracle/port-dump.txt
```

## Write-set
- Temp instrument in `src/layout/dot/ns.ts`, `position.ts`, `position-aux.ts`
  (env-gated; removed in T3 when the fix lands, or before).
- `plans/xcoord-ns-degeneracy/oracle/port-dump.txt` (create)
- `plans/xcoord-ns-degeneracy/decision-journal.md` (append)
- `.agent-notes/xcoord-ns-degeneracy-localization.md` (create)

## Read-set
- `oracle/c-dump.txt` (from T1)
- `position.ts:40-152` (setXcoords, connectGraph, makeAuxEdge)
- `position-aux.ts` (make_LR_constraints, lrRankPair, selfWidth)
- `ns.ts:307-460` (lrBalance, tbBalance, rank2Loop, rank2Balance)
- `ns-core.ts` (addTreeEdge, exchangeTreeEdges — enter/leave)

## Output interface (consumed by T3)
```
{ divergenceStage: 1 | 2 | 3 | 4,
  file: string, function: string,
  description: string,        // what differs and the C-faithful expectation
  cFaithfulFix: string }      // the specific C branch/order to port
```
Recorded as a `decision-journal.md` entry.

## Acceptance criteria
- Given both dumps, when diffed, then the first differing stage is identified
  unambiguously and written to the decision journal.
- Given the localized site, when cross-checked against the C source, then the
  C-faithful corrected behaviour is described concretely (not "looks off").
- Given ADR-4, when port `setXcoords` is compared to position.c:142-148, then
  any control-flow mismatch is noted (or confirmed equivalent).
- If divergence stage 1/2 traces to non-derivable C pointer/alloc order → STOP
  (ADR-3) and report; do not proceed to T3.

## Observability
N/A — diagnostic only.

## Rollback
Reversible. Port instrumentation is temporary and env-gated; removed by T3.

## Boundaries
- Never do: apply a fix in this task; T2 only localizes.
- Ask first: if the localized fix site is OUTSIDE the provisional write-set
  (ns.ts/position.ts/position-aux.ts/classify.ts), invoke the write-set
  expansion rule before T3.
