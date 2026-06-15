# Comparison page — multi-rank left-bulge exclusions (SR7)

**Status:** journal-EXCLUDED at SR7 (2026-06-14). SR7 ports the faithful
multi-rank chain path (`make_regular_edge` hackflag forward) and matches dot
15.0.0 within 0.32pt for the steering cases pinned in
`edge-route-chain-oracle.test.ts` (`A:n->C`, `A:e->C`, 3-rank `A:n->D`). Two
families remain >0.5pt and are surfaced here.

Both involve the chain loop bulging **left past x≈0**, where TS clamps but dot
lets the spline go negative. The whole loop is then translated right by the
clamped amount (the X is uniformly shifted; the shape and Y are otherwise
faithful).

## 1. Left-lateral port — `digraph{A:w->C; A->B->C}`

[dot 15.0.0](multirank-left-w-dot1500.svg) · [graphviz-ts](multirank-left-w-ts.svg)

| pt | dot 15.0.0 | graphviz-ts | Δ |
|----|-----------|-------------|---|
| 0 | 25.30,-162.00 | 46.30,-162.00 | 21.00 |
| 1 | -21.00,-162.00 | 0.00,-162.00 | 21.00 |
| 2 | 7.30,-87.00 | 28.10,-87.00 | 20.80 |
| 3 | 26.40,-45.60 | 47.10,-45.60 | 20.70 |

dot's loop swings out to x=-21 (left of the drawing origin); TS clamps the
left excursion at x=0 and the entire loop shifts ~21pt right. Y matches.

## 2. Deep chain (≥4 ranks) — `digraph{A:n->E; A->B->C->D->E}`

[dot 15.0.0](multirank-left-deep-dot1500.svg) · [graphviz-ts](multirank-left-deep-ts.svg)

The 4-rank loop dips to x=-11.1 at its deepest point (pt 8 region); TS clamps
to x=0 and shifts ~11pt right (start 27 → 38.1). The 2- and 3-rank TOP cases
(`A:n->C`, `A:n->D`) do not reach the left boundary and match within 0.32pt.

## Diagnosis

- The faithful chain assembly, `beginPath` side-box steering, `completeRegularPath`
  widening and `routeSplines` are correct for loops that stay within the drawing
  bounds (the pinned cases match to 0.32pt).
- When the loop needs to bulge left of x≈0, the assembled corridor's left extent
  does not reach as far negative as dot's, so `Pshortestpath` keeps the spline at
  the boundary and the loop translates right. The left extent derives from
  `computeLeftBound`/`maximal_bbox` left clamping for the chain's virtual nodes —
  a corridor-extent question, not a `Proutespline`/`Pshortestpath` numeric
  divergence (Y and shape are faithful).
- Not chased per the mission boundary (>0.5pt; corridor-extent, not a 1–3 line
  attachment/clip tweak). The straight-mode run optimization (`straight_len`,
  for long straight chain runs) is also unported — it did not fire for the
  ≤3-rank cases here but would be needed for longer real chains.

## Why excluded (not fixed) at SR7

- The named steering cases (TOP, RIGHT-lateral, up to 3 ranks) match dot 15.0.0
  within 0.32pt and are pinned. The brief's demo `digraph{A:n->C; A->B->C}`
  passes.
- Left-bulge corridor extent (and straight-mode) are larger corridor-assembly
  changes beyond the chain-feed scope; surfaced per the excluded-case rule. No
  115-golden uses a multi-rank side-port edge, so output is byte-stable (AD3).

## SR4 compound `A:n->B:s` re-test (carried)

Per the SR7 brief, the SR4-excluded compound `digraph{A:n->B:s}` was re-tested
here. It is an **adjacent**-rank edge (single rank box), not a multi-rank chain,
so SR7's chain path does not apply; it still diverges ~17pt in the mid-corridor
(TS x=70.7 vs dot x=87.5), unchanged from SR4. It remains excluded — see
[An-Bs-double-steering.md](An-Bs-double-steering.md). Its combined tail+head
side-mask corridor width is a separate adjacent-corridor question.
