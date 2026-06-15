# Comparison page — flat side-port exclusions (SR5)

**Status:** journal-EXCLUDED at SR5 (2026-06-14). SR5 ports the **non-adjacent**
flat box-channel branch (`make_flat_edge` top-routing + `make_flat_bottom_edges`)
behind the side-mask gate. Two families remain outside 0.5pt and are surfaced
here, not chased.

dot 15.0.0's `make_flat_edge` splits same-rank edges into:
- **adjacent** endpoints → `make_flat_adj_edges` (rotated recursive aux pipeline)
- **non-adjacent** endpoints → the box-channel branch (ported by SR5)

Adjacency = whether a NORMAL (or labeled-virtual) node sits between the endpoints
in rank order (`lib/dotgen/flat.c:checkFlatAdjacent`). The SR5 tests force
non-adjacency with an invisible same-rank ordering chain `A->C->B`.

## 1. Bottom-tail cases — faithful shape, constant vertical offset

`digraph{{rank=same; A->C->B [style=invis]} A:s->B:s}` —
[dot 15.0.0](flat-bottom-dot1500.svg) · [graphviz-ts](flat-bottom-ts.svg)

| pt | dot 15.0.0 | graphviz-ts | Δ |
|----|-----------|-------------|---|
| 0 | 27.00,-24.50 | 27.00,-31.56 | 7.06 |
| 1 | 27.00,3.75 | 27.00,-3.31 | 7.06 |
| 2 | 139.23,7.06 | 139.23,0.00 | 7.06 |
| 3 | 165.53,-14.57 | 165.53,-21.63 | 7.06 |

The X coordinates match **exactly** and the loop is the correct shape; the
entire spline is translated a **constant 7.06pt** in y. The mixed `A:s->B:n`
case (top branch, `:s` tail) shows the same pattern at ~4.9pt. The offset
appears only when the **tail port is BOTTOM (`:s`)** — the
`BeginFlatSide.bottom` / `EndFlatSide.bottom` end-box interaction with the
makeregularend extent. The aligned top/lateral cases (`A:n->B:n` exact,
`A:e->B:w` 0.25pt) are pinned in `splines-flat-oracle.test.ts`.

This is a constant translation, not a shape error or a Proutespline/Pshortestpath
numeric divergence; it traces to the frozen `BeginFlatSide`/`EndFlatSide` bottom
box geometry (`src/common/splines-path-begin.ts`/`-end.ts`, AD5). Per the
mission boundary a >0.5pt divergence into frozen common code is surfaced, not
chased.

## 2. Adjacent flat edges — fall back to the simplified fitter

`digraph{{rank=same; A; B} A:n->B:n}` —
[dot 15.0.0](flat-adjacent-dot1500.svg) · [graphviz-ts](flat-adjacent-ts.svg)

When A and B are adjacent (nothing between them), C routes via
`make_flat_adj_edges` — a recursive call that re-runs the dot pipeline on a
90°-rotated clone and copies the splines back. The TS `makeFlatAdjEdges`
(splines-flat.ts) runs the aux pipeline but the spline copy-back is **deferred**
(noted since SR2). So `routeFlatEdgeFaithful` returns null for adjacent edges
and they fall back to the simplified fitter (a straight segment instead of dot's
loop). dot's loop: `27,-37 27,-65 81,-69 95,-48`; TS straight: `54,-18 …`.

Completing `make_flat_adj_edges` (recursive rotated pipeline + coordinate
copy-back) is a separate, larger port than the box-channel feed SR5 covers; it
is left as a follow-up. No 115-golden uses a flat edge, so byte-stability is
unaffected either way (AD3).

## Why excluded (not fixed) at SR5

- SR5's scope is feeding the already-ported `BeginFlatSide`/`EndFlatSide` box
  branch (non-adjacent). It delivers exact/within-tolerance routing for the
  aligned top and lateral cases.
- The bottom-tail offset traces into the frozen begin/end side-box geometry
  (AD5); the adjacent case needs the deferred `make_flat_adj_edges` recursive
  pipeline. Both are beyond the box-feed scope and are surfaced per the
  excluded-case rule.
