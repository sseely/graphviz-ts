# T1 — Diagnose flat-edge routing divergence (#241_0)

## Context
Faithful TS port of C graphviz (`~/git/graphviz`, tag 15.1.0 = spec). The dot
parity harness (`test/corpus/`) renders inputs through native `dot` and the
port. `tests/241_0.dot` has a `{rank=same}` block with diagonal compass-port
edges. The compass ENDPOINTS are already correct (prior mission); the flat-edge
ROUTING between them diverges. Exemplars (oracle `<` vs port `>`):
- `3:sw->2:se`: oracle `M228.98,-10.86C...0.37 1.79...-3.95` (curls below);
  port `M227.98,-2.98C217.82,-2.98...197.49,-2.98` (STRAIGHT).
- `1:se->6:sw`: oracle `M114.02,-7.88C...432.62,-7.88`; port `...,0...,0`
  (y-offset -> 7.88 global bbox shift).
- `5:ne->8:nw`: largest Δ=126; oracle curls up, port routes very differently.

## Task
`Instrument` native C `make_flat_edge` and `dump` the flat-edge boxes + routed
spline control points for the three exemplar edges; `dump` the port's; `locate`
the divergent port function with its C reference and a one-line root cause. Do
NOT edit `src/`.

1. Build/refresh the instrumented oracle (memory `recover-slack-and-c-harness`):
   rebuild `gvplugin_dot_layout`, copy to `/tmp/gvplugins`. Add temporary
   `fprintf` dumps in C `make_flat_edge` / `make_flat_bottom_edges` /
   `makeFlatEnd` / `makeBottomFlatEnd`: the boxes[] array, the chosen
   top-vs-bottom path, and the routed spline control points for each exemplar.
2. Dump the port's equivalents: in `splines-flat.ts` (`makeFlatEdge`,
   `topBoxes`/`bottomBoxes`, `makeFlatEndBox`) via a small `tsx` probe — boxes
   and `e.info.spl` control points for the same edges.
3. Compare. Pin the FIRST divergence (box geometry vs top/bottom selection vs
   spline fit). Name the divergent function `file:line` + a one-line root cause.
   State whether all three exemplars share one cause (`sharedCause`).

## Write-set
- `plans/flat-edge-routing-241/decision-journal.md` (T1 rows).
- Never edit `src/` in T1. (Temporary C `fprintf` dumps reverted before end.)

## Read-set
- `tests/241_0.dot`; cached oracle `$TMPDIR/dot-corpus-oracle/241_0.svg`.
- C: `lib/dotgen/dotsplines.c` (`make_flat_edge` ~1150-1300, `make_flat_bottom_edges`,
  `makeFlatEnd`, `makeBottomFlatEnd`).
- Port: `src/layout/dot/splines-flat.ts` (`makeFlatEdge`:310, `topBoxes`:359,
  `bottomBoxes`:379, `makeFlatEndBox`:339, `makeFlatAdjEdges`:266).
- `decisions.md#ad-2` (instrument first), `#ad-4` (scope guard).

## Interface contract (consumed by T2)
`{ divergentFn (file:line), cRef (file:line), rootCause (1 line),
  exemplarEdges: string[], sharedCause: boolean }`.

## Acceptance criteria (Given/When/Then)
- **Given** instrumented C, **when** `241_0.dot` renders, **then** the flat
  boxes + routed control points for the three exemplar edges are dumped verbatim.
- **Given** the port probe, **then** the matching port values are dumped.
- **Given** both dumps, **then** the first divergence is located and the
  divergent port function is named with `file:line` + a one-line root cause.
- **Given** the findings, **when** T1 ends, **then** T2 can scope its fix with
  no further diagnosis, and `sharedCause` is stated.

## Observability
N/A — diagnostic only.

## Rollback notes
Reversible — plan-doc append only; revert any temporary C `fprintf` edits.

## Boundaries
- **Always:** map each SVG path index to the exact same-rank edge before dumping;
  dump real C values before hypothesizing; pin the FIRST divergence.
- **Never:** edit `src/`; assume the cause from the candidate list without a dump.
- **STOP (AD-4):** if the cause is a deep multi-cause flat-routing rewrite, not
  an isolated box/curl branch -> report and end.

## Commit
`docs(T1): diagnose #241_0 flat-edge routing divergence`.

## Quality bar
No `src/` change committed. Return only the structured findings.
