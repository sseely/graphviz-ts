# T1 — Pin the FLATEDGE end-box x-placement divergence

## Context
Faithful TS port of C graphviz (`~/git/graphviz`, tag 15.1.0 = spec). The
flat-edge-routing-241 diagnosis (on main) localized #241_0's non-adjacent
flat-edge divergence to the flat-END box: C places it at the node CENTRE
(`tlast=[99,109]` for `1:se->6:sw`, node1 centre x=99), the port at the node
EDGE (`[126,136]` = centre+rw=27). vspace/stepx/stepy already match (36/9/18).
The shift lives in `makeFlatEnd` -> `maximal_bbox` -> begin/endpath FLATEDGE.

## Task
`Instrument` native C `beginpath`/`endpath` (FLATEDGE path) and `dump` the
end-box x at each stage for `1:se->6:sw`'s tail (node1) and head (node6) boxes;
`pin` the exact port line in `splines-path-begin.ts`/`splines-path-end.ts` that
uses the node-edge reference; `confirm` it is FLATEDGE-gatable. Do NOT edit
`src/`.

1. Build/refresh the instrumented oracle: rebuild `gvplugin_dot_layout`, copy to
   `/tmp/gvplugins`. Add temporary `fprintf` in C `beginpath`/`endpath` (the
   FLATEDGE sidemask branch) dumping the box LL.x/UR.x and the node coord.x/rw/lw
   for node1 (tail) and node6 (head).
2. Compare to the port: trace `makeFlatEndBox` -> `beginPath`/`endPath`
   (`splines-path-begin.ts`/`-end.ts`) for the same boxes; identify the exact
   expression that yields `coord.x + rw` (port) where C yields `coord.x`.
3. Confirm whether the divergent expression is on a FLATEDGE/sidemask-specific
   branch (gatable) or shared with regular edges (AD-4/AD-5 risk). State
   `gatable`.
4. Restore the clean C plugin to `/tmp/gvplugins` (oracle must stay native).

## Write-set
- `plans/flatedge-box-x/decision-journal.md` (T1 rows).
- Never edit `src/` in T1. (Temporary C `fprintf` dumps reverted before end.)

## Read-set
- `tests/241_0.dot`; cached oracle `$TMPDIR/dot-corpus-oracle/241_0.svg`.
- C: `lib/dotgen/dotsplines.c` (`makeFlatEnd`, `maximal_bbox`); `lib/common/
  splines.c` (`beginpath`/`endpath` FLATEDGE / BeginFlatSide / EndFlatSide).
- Port: `src/common/splines-path-begin.ts` (FLATEDGE/side helpers ~37-101),
  `src/common/splines-path-end.ts` (FLATEDGE side helpers ~119-185),
  `src/layout/dot/splines-flat.ts:makeFlatEndBox` (~339),
  `src/layout/dot/edge-route-faithful.ts:maximalBbox` (~123).
- flat-edge-routing-241 `decision-journal.md` (the box dumps); `decisions.md#ad-2`,
  `#ad-4`, `#ad-5`.

## Interface contract (consumed by T2)
`{ divergentFn (file:line), cRef (file:line), correctXref (string), gatable: boolean }`.

## Acceptance criteria (Given/When/Then)
- **Given** instrumented C, **when** `241_0.dot` renders, **then** the FLATEDGE
  end-box LL.x/UR.x + node coord.x/rw/lw are dumped for node1 and node6.
- **Given** the port trace, **then** the exact line yielding `coord.x + rw` (vs
  C's `coord.x`) is named with `file:line`.
- **Given** the comparison, **then** `gatable` is stated (FLATEDGE-specific vs
  shared with regular edges).
- **Given** the findings, **when** T1 ends, **then** T2 can scope its fix with no
  further diagnosis, and the clean C plugin is restored.

## Observability
N/A — diagnostic only.

## Rollback notes
Reversible — plan-doc append only; revert temporary C `fprintf` edits + restore
the clean plugin.

## Boundaries
- **Always:** dump real C values before hypothesizing; restore the native plugin.
- **Never:** edit `src/`; touch the adjacent `make_flat_adj_edges` path.
- **STOP (AD-4/AD-5):** if the x-reference is shared with regular edges and not
  gatable -> report and end.

## Commit
`docs(T1): pin #241_0 FLATEDGE end-box x-placement divergence`.

## Quality bar
No `src/` change committed; clean C plugin restored. Return only the structured
findings.
