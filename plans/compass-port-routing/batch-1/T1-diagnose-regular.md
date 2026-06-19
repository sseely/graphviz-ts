# T1 — Diagnose regular-edge compass-port divergence (#2168)

## Context
Faithful TS port of C graphviz (`~/git/graphviz`, tag 15.1.0 = spec). The dot
parity harness (`test/corpus/`) renders corpus inputs through native `dot` and
the port. `tests/2168.dot` is a 2-node digraph, `splines=true`, two regular
edges with **head** compass ports: `node1 -> node2:sw` and `node1 -> node2:ne`.
It diverges (Δ≈16): the oracle places edge endpoints at the compass-port points
(edge1 → ~`12.24,0`), the port elsewhere (edge1 → ~`0,-8.89`).

## Task
`Instrument` native C dot and the port; `dump` the actual compass-port offsets
and routed spline for `2168.dot`; `identify` the single divergent port function
with its C reference. Do NOT edit `src/`.

1. Build/refresh the instrumented oracle (memory `recover-slack-and-c-harness`):
   rebuild `gvplugin_dot_layout`, copy to `/tmp/gvplugins`. Add temporary
   `fprintf` dumps in C for: `ED_head_port(e).p` / `.defined` / `.side`, the
   `endpath` box, and the final routed spline control points for both edges.
2. Dump the port's equivalents: `e.info.head_port`/`tail_port`, the endpath box,
   and `e.info.spl` control points (a small `tsx` probe like the one used in the
   spline-segmentation T1).
3. Compare. Pin the FIRST divergence (port offset vs box vs routed spline) and
   name the divergent function `file:line` + a one-line root cause.

## Write-set
- `plans/compass-port-routing/decision-journal.md` (T1 rows only).
- Never edit `src/` in T1. (C `fprintf` dumps are temporary; revert before end.)

## Read-set
- `tests/2168.dot`; cached oracle `$TMPDIR/dot-corpus-oracle/2168.svg`.
- C: `lib/common/shapes.c:compassPort`, `lib/common/splines.c` (beginpath/
  endpath), `lib/dotgen/dotsplines.c` (make_regular_edge, `ED_head_port`).
- Port: `src/common/compass-port.ts`, `src/common/splines-path-shared.ts`,
  `src/common/splines-path-end.ts`, `src/layout/dot/edge-route-boxes.ts`,
  `src/layout/dot/edge-route-faithful.ts`.
- `decisions.md#ad-2` (instrument first), `#ad-4` (scope guard).

## Interface contract (consumed by T3)
`{ case: "2168", divergentFn (file:line), cRef (file:line), rootCause (1 line),
  exemplarId: "2168" }`.

## Acceptance criteria (Given/When/Then)
- **Given** instrumented C, **when** `2168.dot` renders, **then** both edges'
  `ED_head_port.p`, endpath box, and routed control points are dumped verbatim.
- **Given** the port probe, **then** the matching port values are dumped.
- **Given** both dumps, **then** the first divergence is located and the
  divergent port function is named with `file:line` + a one-line root cause.
- **Given** the findings, **when** T1 ends, **then** T3 can scope its fix with
  no further diagnosis.

## Observability
N/A — diagnostic only.

## Rollback notes
Reversible — plan-doc append only; revert any temporary C `fprintf` edits.

## Boundaries
- **Always:** dump real C values before hypothesizing; pin the FIRST divergence.
- **Never:** edit `src/`; assume the cause from the candidate list without a dump.
- **STOP (AD-4):** if the cause is a deep multi-cause routing divergence, not an
  isolated compass-port endpoint/box branch → report and end.

## Commit
`docs(T1): diagnose #2168 regular compass-port routing divergence`.

## Quality bar
No `src/` change committed. Return only the structured findings.
