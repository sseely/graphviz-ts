# T1 — DOT-12: reposition aux label vnode onto the routed spline

## Context

graphviz-ts is a faithful TS port; C at `~/git/graphviz` (15.0.0) is the
spec. For `{rank=same; a b} a:e->b:w[label="x"]`, the spline is byte-exact
(DOT-11a) but the label lands ~26pt too high. Root cause (C-instrumented):
in the aux graph's `dot_splines_`, routing the labeled cross-rank edge via
`make_regular_edge` moves the label vnode onto the spline (x 33→11.71);
TS's aux routing leaves it at the position-phase x (51). The label is
placed at `vnode.x + dimen.y/2`, so the un-repositioned vnode mislays it.

## Task

**Step 1 — pin the exact C reposition (harness).** Instrument
`make_regular_edge` (`dotsplines.c:1700+`) to dump the label vnode coord
across its internal steps (boxes, `routesplines`, label handling) and
find the exact statement that sets the vnode x from 33 to 11.71. Build:
`cd ~/git/graphviz/build && make dotgen && make gvplugin_dot_layout && cp -f
plugin/dot_layout/libgvplugin_dot_layout*.dylib /tmp/gvplugins/`. Restore +
rebuild + re-copy when done. Record the C line in the journal.

**Step 2 — find the TS counterpart.** Locate where TS's regular-edge
router positions a labeled edge's label vnode (the aux graph runs the same
routers). Determine why it doesn't reposition the vnode onto the spline.

**Step 3 — port faithfully.** Make TS's aux label vnode land where C's
does (11.71, 45 for the canonical input). Scope strictly to the labeled
regular-edge path; do NOT change non-labeled or non-aux behavior.

## Write-set

- The regular-edge router file(s) the reposition belongs in
  (`src/layout/dot/edge-route.ts` / `edge-route-faithful.ts` /
  `splines-label.ts` — determined in Step 2)
- A colocated `.test.ts` (unit assertion on the aux vnode position)

## Read-set

- `~/git/graphviz/lib/dotgen/dotsplines.c:1700-1920` (make_regular_edge)
- `src/layout/dot/splines-flat.ts:182-260` (aux pipeline)
- `decisions.md#ad-1`, `#ad-2`

## Architecture decisions

AD-1 (reposition is the fix; scope to aux/regular router; gate on goldens),
AD-2 (do NOT touch coordinate normalization). Locked.

## Acceptance criteria

- Given the canonical input, when `makeFlatAdjEdges` runs, then the aux
  label vnode is at (11.71, 45) within 0.5pt before postproc (unit probe).
- Given `npx vitest run`, then ≥ 1855 pass, zero golden churn (no
  regular-edge label regression).
- (End-to-end label position is asserted in T2, after the copy-back.)

## Observability / Rollback

N/A. Reversible — revert the commit.

## Comparison page

Folded into T2's `comparisons/dot-10-label.md` (label only visible after
copy-back). Record the pinned C line + the aux vnode value here in the
journal.

## Commit

`fix(T1): reposition aux label vnode onto spline (DOT-12)`
