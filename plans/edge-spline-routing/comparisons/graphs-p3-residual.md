<!-- SPDX-License-Identifier: EPL-2.0 -->

# Deferred residual: `graphs-p3` under-segmentation (D3)

## Status

**Deferred (D3 — separate routing bug).** Accepted by the user when committing
T2 (decision-journal 2026-06-23). T2's faithful edge-order fix
(`fix(T2)` 16da31b) regressed this one verdict (structural-match → diverged)
while **improving its geometry** — it is recorded here per CLAUDE.md ("any
quarantined/excluded case needs a comparison page referenced in the journal").

## What happened

| | verdict | maxDelta | firstDiffPath |
|--|---------|----------|---------------|
| main (pre-T2) | structural-match | **72** | — |
| T2 | diverged | **0.48** | `svg/g[1]/g[17]/path[1]/@d` |

Input: `~/git/graphviz/tests/graphs/p3.gv` (undirected, 16 edges). The diverging
element is edge **`sleep--runmem`**, a long edge spanning several ranks:

```
oracle (4 cubics): M188.39,-290.07 C179.23,-280.1 168.04,-266.25 161.37,-252
                     147.51,-222.4 149.72,-212.51 146.37,-180
                     144.73,-164.08 144.01,-159.83 146.37,-144
                     152.27,-104.29 168.18,-59.74 177.43,-36.02
port   (3 cubics): M188.68,-290   C179.69,-280   168.67,-266.15 162,-252
                     148.02,-222.35 149.58,-212.58 146,-180
                     140.14,-126.59 163.31,-65.3   176.23,-36.14
```

The port emits **3** cubic pieces where the oracle emits **4**; the curve is
otherwise near-identical (maxDelta 0.48).

## Why this is NOT the T2 ordering bug

The port's edge **routing order for p3 is byte-identical to C's**
`dot_splines_` order (verified by instrumenting the C route loop and diffing —
all 14 edges in the same sequence). So `sleep--runmem` routes against the same
corridor neighbours C uses; the one-fewer-piece result is a **separate residual
in the corridor/fitter** (the recursive `Proutespline` fit finds a 3-piece
solution inside a corridor where C splits into 4), independent of routing order.

Before T2 the *wrong* `g.nodes.values()` order happened to give `sleep--runmem`
a 4-piece corridor with badly-placed control points (maxDelta 72), which scored
as "structural-match" (right piece count, wrong geometry). T2's correct order
exposes the true corridor, whose geometry is right (Δ0.48) but whose piece count
under-segments by one. The verdict bucketing (piece-count first) flips it to
"diverged" even though the render is visibly closer.

## Related residuals (same class, also deferred)

The still-diverged `*-rankdir_dot` / `*-rankdir_dot2` rows share this residual
(`path[1]/@d`, long-edge piece count) and **improved** maxDelta under T2:

| id | maxDelta main → T2 |
|----|--------------------|
| linux.x86-rankdir_dot | 40.6 → 36.0 |
| linux.x86-rankdir_dot2 | 55.7 → 33.6 |
| nshare-rankdir_dot | 43.2 → 37.2 |
| nshare-rankdir_dot2 | 58.4 → 34.7 |

## Next step (future mission)

Localize the long-edge piece-count residual at the corridor/fitter level (with
the routing order now correct): instrument C `routesplines_`/`Proutespline` for
`sleep--runmem` and diff the box corridor + `pl` + endpoint slopes vs the port,
as in S1 — but for a graph where the routing order already matches. This is the
brief's original "extra/missing segment" class, minus the order confound.
