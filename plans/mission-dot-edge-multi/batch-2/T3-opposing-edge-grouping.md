# T3 — Port dot_splines edge-grouping loop + multi-edge oracle pins (G1 wiring)

## Context

The C `_dot_splines` gathers consecutive edges that share a main edge into
`cnt`-groups and dispatches each group to `make_regular_edge` /
`make_flat_edge` / `makeSelfEdge` / `makeStraightEdges`
(`lib/dotgen/dotsplines.c:343-420`). graphviz-ts has partial scaffolding
(`getMainEdge`, `groupSize`, `dispatchEdgeGroup` in `src/layout/dot/splines.ts`)
but the corpus shows opposing/labeled-parallel groups are not assembled or
dispatched the way C does. T2 made `make_regular_edge` correct; this task makes
the grouping loop feed it faithfully.

## Task

Port the grouping loop faithfully (`dotsplines.c:343-420`):
- `getmainedge` + `BWDEDGE` `makefwdedge` normalization for the lead edge.
- The `cnt` accumulation: break on different main edge, on `portcmp` tail/head
  mismatch, on FLATEDGE with different label, on `MAINGRAPH` (`-C`). Preserve
  the `ED_adjacent(e0) continue` (all flat-adjacent at once).
- Dispatch: self-edge (`agtail==aghead`) → `makeSelfEdge`; flat
  (`rank(tail)==rank(head)`) → `make_flat_edge`; else `make_regular_edge`; the
  `EDGETYPE_CURVED` → `makeStraightEdges` branch.

Preserve the exact break conditions and ordering — they are load-bearing
(side-effect order in C is intentional, per CLAUDE.md). Do not simplify.

Then pin the now-correct cases as dot-oracle tests (AD-3), verified against the
built dot: opposing (`a->b; b->a`), labeled-parallel (`a->b[label="1"];
a->b[label="2"]`), and (regression) plain unlabeled parallel-x3 stays MATCH.
Any residual >0.5pt → quarantine + comparison page (AD-4).

## Write-set

- `src/layout/dot/splines.ts` — grouping loop (`getMainEdge`, `groupSize`, `dispatchEdgeGroup`)
- `src/layout/dot/edge-route-multi.test.ts` — extend with opposing + parallel pins

## Read-set

- `~/git/graphviz/lib/dotgen/dotsplines.c:343-420` (grouping loop), `:71-110` (getmainedge), `portcmp`/`makefwdedge`
- `src/layout/dot/splines.ts:71-330` (getMainEdge, groupSize, dispatchEdgeGroup)
- `decisions.md#ad-3`, `#ad-4`; T2 spec (router contract)

## Interface contract (consumes T2)

T2 provides a `make_regular_edge` that, given an edge group `edges[ind..ind+cnt]`
and `cnt`, installs correctly-splayed splines (and routes labeled edges around
their label vnodes). T3 supplies those groups in the C-faithful order.

## Acceptance criteria

- **Given** `digraph{a->b; b->a}`, **when** rendered, **then** paths match dot
  within 0.5pt (offset to opposite sides).
- **Given** `digraph{a->b[label="1"]; a->b[label="2"]}`, **when** rendered,
  **then** both paths + both labels match dot within 0.5pt.
- **Given** `digraph{a->b;a->b;a->b}` (unlabeled parallel-x3), **when**
  rendered, **then** still byte-identical to dot (no regression).
- **Given** the full suite, **then** ≥1789 pass / 0 fail, 115 goldens
  byte-identical.

## Quality bar

`tsc --noEmit` 0; lizard clean; vitest green; goldens byte-identical. Commit:
`feat(T3): port dot_splines edge-grouping loop + multi-edge oracle pins`.

## Observability / Rollback

N/A — pure layout. Reversible. Goldens byte diff → STOP (AD-2).
