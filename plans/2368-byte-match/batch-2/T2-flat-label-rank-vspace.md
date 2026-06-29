# T2 — Flat-label-rank vertical spacing (Issue 1)

## Context

2368's drawing is 5pt short (bbox 604×143 vs C 608×148); the top
`{rank=same line7;136}` group and everything above the main flat band sits 5pt
low. The 256→316 label vnode is byte-identical to C (20.0, 40.4), so this is NOT
label-vnode placement — it is the flat-label ("abomination") rank's vertical
separation, fed by `flatNode` height and/or rank `ht1`/`ht2`. C is the spec.

## Task

Apply the spacing correction the T0 trace pinned
(`test/diagnostic/flat-geom-trace.md` — the first rank whose Y or ht differs by
~5pt, C vs port). Likely one of:
- `src/layout/dot/flat.ts:flatNode`/`flatNodeDims` — the label-vnode height that
  sets the flat-label rank's `ht`; if the port computes it ~5pt small, the rank
  packs tighter. Mirror `flat.c:flat_node`.
- `src/layout/dot/position-ycoords.ts` — rank `ht1`/`ht2` / inter-rank spacing
  when `GD_has_labels & EDGE_LABEL`; if the EDGE_LABEL rank gap is ~5pt short,
  fix it to match C `position.c:set_ycoords`.

Change ONLY the site the trace identifies. If both contribute, treat as one
logical unit (one commit). Do not touch ranksep for non-edge-labeled graphs.

## Write-set
- `src/layout/dot/flat.ts` AND/OR `src/layout/dot/position-ycoords.ts`
  (whichever the T0 trace pins; + their unit tests)

## Read-set
- `decisions.md#ground-truth-data` (bbox + label-vnode values)
- `test/diagnostic/flat-geom-trace.md` (T0 output — the pinned ~5pt rank)
- `src/layout/dot/flat.ts:97-160` (flatNode/flatNodeDims)
- `src/layout/dot/position-ycoords.ts` (rank ht1/ht2)
- `~/git/graphviz/lib/dotgen/flat.c` (flat_node), `lib/dotgen/position.c`
  (set_ycoords)

## Interface contracts
None (internal layout). Output is node/rank Y coords; verified by bbox + path
parity.

## Acceptance criteria
- Given 2368, when rendered, then the bbox = C's `608×148` and the top
  `{line7;136}` group's Y matches C (the uniform ~5pt offset is gone).
- Given the full survey, when run, then GATE PASS 0 regressions — else STOP +
  revert (AD-4). (Edge-labeled graphs are the risk surface — watch them.)
- Given 2368_1 and 1624, when rendered, then still byte-match.
- Given the affected unit tests, when run, then green.

## Observability / Rollback
N/A. Reversible (revert the commit).

## Quality bar
`tsc --noEmit` clean; `vitest run` green; survey GATE PASS 0 regressions. Commit:
`fix(flat): correct edge-label rank vertical spacing (2368 bbox)`.
