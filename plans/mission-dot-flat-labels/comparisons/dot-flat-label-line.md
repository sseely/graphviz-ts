# RESOLVED (was: Quarantine — non-adjacent flat label with `splines=line`)

**Status (2026-06-16, follow-up branch `feature/flat-label-followups`).**
**RESOLVED.** The `splines` graph attribute is now wired into the edge type
(`setEdgeTypeFromAttr` in `src/layout/dot/index.ts` + `edgeTypeFromString` in
`splines.ts`, porting `lib/common/utils.c:setEdgeType`/`edgeType`). With
`splines=line` honored, the non-adjacent flat label now renders the 7-point
polyline **byte-exact** to dot 15.0.0 and is pinned as a full-render oracle test
in `splines-flat-labeled.test.ts` (`splines=line — non-adjacent flat label`).
The historical context below is retained for reference.

---

**Original quarantine (2026-06-16, T2).** The `EDGETYPE_SPLINE` (dot default)
case is **byte-exact** to dot 15.0.0 and pinned in `splines-flat-labeled.test.ts`.
The `splines=line` sub-case was **quarantined**: it could not be exercised
end-to-end because the `splines` graph attribute was **not wired** into the edge
type — `dotPhaseInit` hardcoded `setEdgeType(g, EDGETYPE_SPLINE)`, and
`edgeType(g)` never read `splines`.

This is **not** a `make_flat_labeled_edge` geometry-parity failure. The
`EDGETYPE_LINE` 7-point branch (`flatLabeledLinePoints`) is ported faithfully
(dotsplines.c:1335-1347) and unit-tested directly in
`splines-flat-labeled.test.ts` — it is simply never reached at render time
because the global edge type is always `EDGETYPE_SPLINE`.

## Case

```
digraph{ splines=line; {rank=same; a->c->b[style=invis]} a->b[label="x"] }
```

Oracle: `~/git/graphviz/build/cmd/dot/dot -Tsvg`, `GVBINDIR=/tmp/gvplugins`,
graphviz 15.0.0.

## dot 15.0.0 (EDGETYPE_LINE)

- Label `x` at `(117, -57.2)`.
- Edge `a->b` path (7-point polyline, rendered):
  `M50.18,-27.27C76.84,-37.94 117,-54 117,-54 117,-54 147.74,-41.7 173.3,-31.48`

## graphviz-ts (actual)

`splines=line` is ignored, so TS renders the **spline** path instead:
`M45.88,-31.26C62.74,-42.24 88.59,-57 113.62,-63.12 138.5,-69.21 164.55,-54.61 182.8,-40.43`
(byte-identical to dot's **spline** output). The label `x` is emitted at the
correct `(117, -57.2)`.

## Root cause

`splines`/`EDGE_TYPE` attribute parsing is unported. In C, `dot_init_graph`
maps the `splines` attribute (`none|line|polyline|curved|ortho|spline|true|…`)
to the edge type via `setEdgeType`; this port always uses `EDGETYPE_SPLINE`.

## Resolution path

Wire the `splines` attribute → `setEdgeType` in `dotPhaseInit`
(`src/layout/dot/index.ts`) as a dedicated task. That is a separate
graph-init/attribute feature touching all engines, outside this flat-label
mission's scope (`splines-flat*`); pulling it in would risk the 115 goldens for
an unrelated reason. Once wired, the `EDGETYPE_LINE` full-render path here will
exercise `flatLabeledLinePoints` (already verified) and should match dot's line
output within 0.5pt — promote this quarantine to a pinned oracle then.
