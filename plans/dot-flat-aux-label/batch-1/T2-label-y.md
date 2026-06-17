# T2 — DOT-11b: aux label Y tracks the repositioned vnode

## Context

After T1, the aux labeled-flat spline and label X are correct, but the
label Y is frozen at a pre-reposition value: aux edge `label.pos.y = 59.25`
while the repositioned label vnode `coord.y = 72`. The label vnode has
`in:1, out:1` (not the `in.size==0` flat skip). `placeRegularEdgeLabels`
(`splines-label.ts:314`, called from `dotSplines_` at `splines.ts:409`,
which runs AFTER reposition) → `placeVnlabel` should set
`l.pos.y = vnode.coord.y`, but the edge's label retains 59.25.

## Task

**Step 1 — localize (read, don't guess).** Determine why the aux edge
label is not updated from the repositioned vnode. Likely causes:
- `placeVnlabel` sets the EDGE's label via `vnode.out.list[0] → normal edge`,
  but the aux edge's `info.label` is a different object than the one set, or
- the label was set earlier (pre-reposition) and `l.pos` is mutated in place
  on a stale object, or
- `placeRegularEdgeLabels` is not reached for the aux graph's vnode.
  Add a temporary probe in `makeFlatAdjEdges` if needed; remove before commit.

**Step 2 — fix faithfully.** Ensure the aux edge label is positioned from
the repositioned vnode coord (C does this in `dot_splines_ → setEdgeLabelPos`,
after reposition). Prefer the minimal change that makes the aux edge's
`label.pos.y` follow `vnode.coord.y` post-reposition.

## Write-set

- `src/layout/dot/splines-label.ts` (and/or `src/layout/dot/splines-flat.ts`
  if the cleanest fix is to refresh the label inside the aux path)

## Read-set

- `src/layout/dot/splines-label.ts:62-104` (placeVnlabel, setEdgeLabelPos,
  setAlgLabelPos), `:303-322` (placeRegularEdgeLabels)
- `src/layout/dot/splines-flat.ts:247-260` (makeFlatAdjEdges order)
- `~/git/graphviz/lib/dotgen/dotsplines.c:199-212, 484-510`
- `decisions.md#ad-2`

## Architecture decisions

AD-2: **scope to the aux/flat-adj path.** Do NOT change label placement for
regular non-aux graphs — that risks the 1853 goldens. If the only correct
fix is global, STOP and surface it.

## Acceptance criteria

- Given `{rank=same a b} a:e->b:w[label="x"]`, when routed (after T3 copy-
  back), then the label "x" is at (72, -32.91) within 0.5pt — i.e. the aux
  edge `label.pos.y` resolves to ~72 in the aux frame (maps to -32.91).
- Given `npx vitest run`, then >= 1853 pass, zero golden churn (no regular-
  edge label regression).

> T2's user-visible oracle assertion is realized together with T3 (the copy-
> back surfaces the label). T2 alone is verified by asserting the aux edge
> `label.pos.y` tracks the repositioned vnode (unit-level), then confirmed
> end-to-end in T3.

## Observability / Rollback

N/A. Reversible — revert the commit.

## Comparison page

Folded into `comparisons/dot-10-label.md` (written in T3, since the label is
only emitted after the copy-back).

## Commit

`fix(T2): aux edge label tracks repositioned vnode (DOT-11b)`
