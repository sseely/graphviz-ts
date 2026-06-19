# Quarantine: `dot-curved-cycle` — splines=curved 2-cycle

**Fixture:** `test/golden/inputs/dot-curved-cycle.dot`
(`digraph { splines=curved; a -> b; b -> a; }`)
**Native-C ref:** `test/golden/refs/dot-curved-cycle.svg`
(minted `GVBINDIR=/tmp/gvmine ~/git/graphviz/build/cmd/dot/dot -Tsvg`)
**Status:** quarantined (removed from `manifest.json`); fixture + ref retained
for re-promotion once the gap below closes.

## Divergence

The curved routing is **structurally correct** — the port now emits two
separate single bent edges (a→b and b→a), matching C's grouping. The residual
is a constant horizontal offset on each edge's start point:

| element | port | native C |
|---------|------|----------|
| `a->b` path start x | `27` | `32.92` |
| `b->a` path start x | `27` | `21.08` |

C separates the two opposing edges by ±5.92 in x; the port routes both at the
node-center x (27), so they overlap.

## Root cause (NOT in the curved code)

The ±5.92 separation is the **multiedge port offset** stored in
`ED_tail_port(e).p` / `ED_head_port(e).p`. C's `makeStraightEdges`
(`routespl.c:984-985`) reads these ports:

```
dumb[0] = add_pointf(ND_coord(n), ED_tail_port(e).p);
```

C's port-assignment phase sets `ED_tail_port` to ±5.92 for adjacent multiedges
**before** `dot_splines_` runs. The TypeScript port does **not** populate
`ED_tail_port` for these edges — it leaves them `(0,0)` and instead computes the
multiedge offset lazily inside its non-curved router (`routeRegularEdgeFaithful`
→ box steering). Confirmed by instrumentation: at `makeStraightEdges` time both
cycle edges have `tail_port=(0,0)`, `head_port=(0,0)`.

Evidence the offset mechanism exists for the non-curved path: the **default
splines** 2-cycle (`a->b; b->a` with no `splines=curved`) renders **byte-for-byte
identical to C** (port and C both `21.12` / `32.86`). So the port CAN produce the
offset — it just does so in the regular router, not in `ED_tail_port`, which the
faithful `makeStraightEdges` reads.

## Why not fixed here

Populating `ED_tail_port` for adjacent multiedges means porting C's port-
assignment phase (`class2`/`dot_position` multiedge port distribution) — a
subsystem orthogonal to curved routing and outside this mission's write-set
(`straight-edges.ts`/`compound*.ts`). Faithfully, `makeStraightEdges` must read
the ports (ADR-5), not recompute offsets, so the fix belongs upstream.

## Re-promotion

When the multiedge port-assignment port lands (`ED_tail_port` populated before
`dot_splines_`), re-add this entry to `test/golden/manifest.json` and bump the
suite count. The C ref is already minted and should then pass unchanged.
