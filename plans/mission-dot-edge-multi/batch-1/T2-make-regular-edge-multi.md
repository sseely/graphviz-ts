# T2 — Port make_regular_edge multi-edge / label-vnode logic (G1 core)

## Context

graphviz-ts is a faithful TS port of graphviz C (tag 15.0.0, the spec). The
corpus (`route-reverification.md`) shows two regular-edge divergences:
- **labeled parallel** (`a->b[label="1"]; a->b[label="2"]`): dot routes each
  around its label virtual node and splays them; graphviz-ts produces a wiggly
  single path (pathΔ 23pt).
- **opposing** (`a->b; b->a`): dot offsets each ~6.5pt to opposite sides of
  center; graphviz-ts draws one straight and one malformed (pathΔ 53pt).

`makeRegularEdge` in `src/layout/dot/splines-route.ts:254` is a **stub**. Plain
regular edges currently route correctly via the live path in `edge-route*.ts`
(the simplified fitter / faithful side-port pipeline) — those MUST stay
byte-identical (115 goldens). This task ports the C `make_regular_edge`
multi-edge (`cnt>1`) offset and label-virtual-node interior routing into the
**live faithful router**, for the new cases only.

## Task

Port the multi-edge / label sections of `make_regular_edge`
(`lib/dotgen/dotsplines.c:1700-2000`, esp. the `cnt>1` offset loop and the
label-vnode `pointfs` interior shift) into the live regular-edge router.

Per AD-2: route ONLY the new cases (cnt>1 groups, labeled edges with a label
vnode) through the faithful `routeSplines` pipeline. A plain single unlabeled
regular edge must continue through the existing path unchanged.

Faithful details to preserve (read the C — these are the nuances):
- `Multisep` offset: `dx = Multisep * (cnt-1)/2`, then each edge `j` shifted; the
  `routeParallelGroup` scaffold in `splines-route.ts:324` already encodes this —
  finish/wire it.
- The label virtual node interior point shift (the edge bends to pass its label
  box; `make_regular_edge` reads `ED_label` and the vnode chain).
- Back-edge (`BWDEDGE`) geometry via `makefwdedge` then un-flip on install
  (`hackflag` path, `edge-route.ts:274`).

If opposing `a->b`/`b->a` do not group into one `cnt=2` call, their separation
comes from single-edge routing through the shared corridor — port that path
faithfully rather than forcing a grouping that the C does not do. (T3 handles
the grouping-loop side; this task makes the router correct for whatever groups
reach it.)

## Write-set

- `src/layout/dot/splines-route.ts` — finish `makeRegularEdge` + `routeParallelGroup`
- `src/layout/dot/edge-route*.ts` — wire the live dispatch for the new cases (faithful pipeline)
- `src/layout/dot/edge-route-multi.test.ts` — new oracle test

## Read-set

- `~/git/graphviz/lib/dotgen/dotsplines.c:1700-2000` (make_regular_edge), `:267-268` (Multisep/Splinesep init)
- `src/layout/dot/splines-route.ts:245-340` (stub + routeParallelGroup scaffold)
- `src/layout/dot/edge-route.ts:109-320` (live regular routing, hackflag path)
- `decisions.md#ad-2`, `#ad-3`, `#ad-4`

## Acceptance criteria

- **Given** `digraph{a->b[label="1"]; a->b[label="2"]}`, **when** rendered,
  **then** both edge paths match dot within 0.5pt and both labels are present at
  dot's positions.
- **Given** `digraph{a->b; b->a}`, **when** rendered, **then** the two paths are
  offset to opposite sides matching dot within 0.5pt (no malformed path).
- **Given** plain edges (the 25-graph corpus MATCH set), **when** rendered,
  **then** unchanged — 115 goldens byte-identical, ≥1789 pass / 0 fail.
- Any sub-case not reaching 0.5pt is quarantined per AD-4 (comparison page).

## Quality bar

`tsc --noEmit` 0; lizard clean; vitest green; 115 goldens byte-identical (hard
gate). Oracle from the built dot. Commit: `feat(T2): port make_regular_edge
multi-edge routing`.

## Observability / Rollback

N/A — pure layout. Reversible (revert; no goldens change). If a goldens byte
diff appears, STOP (AD-2 violation) — do not adjust the golden.
