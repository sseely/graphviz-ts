# SR1 — Recon spike findings

Date: 2026-06-14. Branch: `feature/parity-edge-ports` (recon only — no
production src changed; steering branch cut deferred to SR2, see Branching).

## Baseline (capture for gates)

- Tests: **1749 passed / 0 failed**, 107 files.
- Goldens: **115**.

## 1. Dispatch map (verified)

`src/layout/dot/index.ts:113 dotLayoutPipeline → dotSplines (splines.ts:374)
→ dotSplines_ (349) → routeDotEdges (edge-route.ts)`.

`routeDotEdges` loops every node's out-edges and calls **`routeOneEdge`**
for each (skips self-edges `tail===head`, already-routed `spl`, and
no-coord edges). `routeOneEdge` dispatches:
- non-forward dir → `routeEdgeNonForward`
- multi-rank back → `routeBackEdge` (edge-route-chain.ts)
- multi-rank fwd → `routeFwdMultiRankEdge` (edge-route-chain.ts)
- regular adjacent → `routeForwardEdge` → `straightEdgeSplineWithRank`
  → `routeWithRank` → `buildRankCorridor` + `computeSpline` (the simplified
  monotonic fitter). T6a's `portRouteOf` feeds port points/clip here.

Flat (same-rank) edges: routed by `splines-flat.ts` via `dotSplines_` on an
aux graph. Self-edges: skipped by `routeDotEdges` (handled elsewhere —
`splines-selfedge.ts`).

## 2. AD1 REVISED — seam is `routeOneEdge`, not `makeRegularEdge`

`splines-route.ts:makeRegularEdge` has **zero callers** — it is dead code,
a partial `make_regular_edge` port that was never wired in (its header still
says "Full pathplan routing is deferred until pathplan.ts is ported"). The
live router is solely `routeOneEdge`.

**Decision:** integrate at `routeOneEdge` — when an edge has an active
side-mask port, route via the faithful pipeline instead of
`straightEdgeSplineWithRank`. `routeOneEdge` already carries T6a's
`portRouteOf` (extend it to detect `.side`). `makeRegularEdge` is NOT
revived (would be a parallel dead path); consider deleting it in a cleanup
once the faithful path lands. **This supersedes decisions.md AD1.**

## 3. KEY RISK — the faithful orchestration has NEVER been assembled

`beginPath`, `endPath`, and `routeSplines` have **zero callers** anywhere in
src. neato/pack/ortho use `clipAndInstall` + `Proutespline` directly with
their own point computation — they do NOT use the `beginpath → routesplines
→ endpath → clip_and_install` box-channel sequence. `routeSplines`'s only
test (`splines.test.ts` AC6) checks the degenerate-box null case.

So the building blocks are ported but the **integration is unproven** — this
mission first-assembles and first-exercises that sequence. Higher risk than
"wire in the proven path." SR2 must treat the assembly itself as the work.

## 4. PoC — GO. routeSplines routes the loop corridor

Hand-built the `A:n->B` loop corridor (the T6b `BeginRegSide.topRight`
boxes: up-strip above A, right-strip beside A, rank gap, B box) and called
`routeSplines(P)`. Result: a complete **10-control-point** spline:
`27,108 → 45.5,116.5 → 54,108 → 56.8,105.2 → 55.3,75.8 → 54,72 → 47.7,53 →
27,36` — starts at the port, loops up (apex 116.5), bulges right (56.8),
reaches B top. **`computeSpline` truncated this corridor; `routeSplines`
routes it completely.** Mission premise confirmed.

C oracle for `A:n->B`: `M27,-109.32 C27,-121.33 45.67,-116.97 54,-108.32 …
43.2,-44.79`. Same shape class (loop up, bulge ~54-65, descend). Exact match
requires the REAL beginPath/endPath boxes + correct ranksep + endpoints
(SR2/SR3) — my hand boxes were approximate — but the routing topology is
right. Probe: `.probes/sr1-poc.ts`.

## 5. beginPath/endPath input contract (for SR2)

`beginPath({P, e, et, endp, merge, inEdges, outEdges, ranksep, pboxfn})`:
- Caller seeds `endp.nb` = node maximal bbox BEFORE calling (BeginRegSide
  reads `endp.nb`; beginPath does not set it). Use the `makeMaximalBbox`
  geometry already in edge-route-boxes.ts.
- `P` fresh (`nbox:0, boxes:[], start/end` ports); beginPath sets
  `P.start.p = coord + tail_port.p` and the side boxes into `endp.boxes`.
- `et` = REGULAREDGE for adjacent regular edges.
- `merge` = `splineMerge(n)`-style; `inEdges`/`outEdges` from node lists
  (for `concSlope` constrained-theta). For the simple single-edge case
  `merge=false`, empty in/out is fine.
- `ranksep`: use `(tailBottom − headTop)` proxy (T6a) or the graph ranksep;
  confirm in SR2 against a multi-edge case.
- `pboxfn`: null for poly nodes (default-path only matters for shaped ports).
- After begin/endpath, the caller assembles `P.boxes` = tail `endp.boxes`
  (boxn) + inter-rank box(es) + head `endp.boxes`, sets `P.nbox`, then
  `routeSplines(P)` → `clipAndInstall(e, e.head, pts, pts.length, sinfo)`.
  This assembly is the missing glue (C `make_regular_edge`).

## 6. Golden-risk (AD3) — deferred to SR2/SR9

Quantifying how `routeSplines` differs from `computeSpline` on a NO-PORT
edge needs the full pipeline incl. `clipAndInstall` (the clip is what makes
the simplified fitter match C exactly for plain edges — see parity-edge-ports
T8). Cannot be answered with a boxes-only probe. SR2 builds the pipeline;
SR9 does the 115-golden re-route comparison. AD2's gate (faithful path only
for side-port edges) keeps the 115 untouched meanwhile.

## Branching

SR1 is recon (no src). SR2 starts production code: cut
`feature/steering-port-routing` from the parity-edge-ports merge point
(T6a/T8 must be on the base). README said "off main" assuming
parity-edge-ports merged — confirm the merge state before SR2.

## Net: batch-2 is GO with AD1 revised

SR2/SR3 target `routeOneEdge` (not `makeRegularEdge`), must assemble +
first-exercise the begin/route/end/clip sequence, and feed it the real
beginPath/endPath boxes. The PoC de-risks the core question (routeSplines
handles loops). Remaining risk is integration correctness, not feasibility.
