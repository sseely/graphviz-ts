# T2 — Diagnose the adjacent flat curl (#241_0 `3:sw->2:se`, `2:ne->3:nw`)

## Context
Same mission/harness as T1. The rank-ADJACENT same-rank edges `2:ne->3:nw` and
`3:sw->2:se` route through `make_flat_adj_edges` (aux-graph clone), a different
path than T1's `routeFlatEdgeFaithful`. They diverge in Y/curl:
- `3:sw->2:se`: oracle curls below (reaches SVG +1.79); port routes straight
  (`M227.98,-2.98 ... 197.49,-2.98`).
- `2:ne->3:nw`: top curl, shape differs.
The adjacent path has prior history (the `dot-flat-aux-label` mission touched
the aux-graph label positioning).

## Task
`Instrument` native C `make_flat_adj_edges` and `dump` the aux-graph boxes +
routed spline for `3:sw->2:se` (+`2:ne->3:nw`); `dump` the port's; `classify`
the FIRST real divergence (box-Y / aux clone / reposition / spline-fit) per AD-5.
Do NOT edit `src/`.

1. Reuse the instrumented oracle (T1's recipe). Dump in C `make_flat_adj_edges`:
   the aux node coords, the cloned edge boxes, `recover_slack`/reposition deltas,
   and the routed spline for `3:sw->2:se`.
2. Probe the port's `makeFlatAdjEdges` (temporary, reverted): aux coords, boxes,
   `copyFlatSplines`/`repositionFlatAux` output for the same edge.
3. Compare (Y-focused, AD-5). Pin the first divergence; name the divergent fn
   `file:line` + root cause; state `isolable` and whether it SHARES a cause with
   T1 (-> collapse T3).
4. Restore the clean C plugin.

## Write-set
- `plans/flat-curl-y/decision-journal.md` (T2 rows).
- Never edit `src/` in T2. (Temporary probes reverted before end.)

## Read-set
- `tests/241_0.dot`; cached oracle `$TMPDIR/dot-corpus-oracle/241_0.svg`.
- C: `lib/dotgen/dotsplines.c:make_flat_adj_edges`, `cloneGraph`, `recover_slack`.
- Port: `src/layout/dot/splines-flat.ts` (`makeFlatAdjEdges`:266,
  `buildFlatAux`:149, `repositionFlatAux`:184, `copyFlatSplines`:244,
  `copyOneFlatSpline`:223).
- `decisions.md#ad-2`, `#ad-4`, `#ad-5`.

## Interface contract (consumed by T3)
`{ path: "adjacent", divergentFn (file:line), cRef (file:line),
  cause (box-Y|aux-clone|reposition|spline-fit), isolable: boolean,
  sharesCauseWithT1: boolean, exemplar: "3:sw->2:se" }`.

## Acceptance criteria (Given/When/Then)
- **Given** instrumented C, **when** `241_0.dot` renders, **then** the aux boxes
  + routed spline for `3:sw->2:se` are dumped verbatim.
- **Given** the port probe, **then** the matching port values are dumped.
- **Given** both (Y-focused per AD-5), **then** the first real divergence is
  located, the fn named `file:line`, and `cause`/`isolable`/`sharesCauseWithT1`
  stated.
- **Given** the findings, **then** T3 can scope its fix; the clean plugin is
  restored.

## Observability
N/A — diagnostic only.

## Rollback notes
Reversible — plan-doc append; revert temporary probes + restore plugin.

## Boundaries
- **Always:** map each SVG path index to the exact adjacent edge; compare FINAL
  coords (AD-5); restore the plugin.
- **Never:** edit `src/`; conflate with the non-adjacent path (T1).
- **STOP:** non-isolable / deep multi-cause (AD-4); frame artifact (AD-5).

## Commit
`docs(T2): diagnose #241_0 adjacent flat curl-Y`.

## Quality bar
No `src/` change committed; clean plugin restored. Return only the structured
findings.
