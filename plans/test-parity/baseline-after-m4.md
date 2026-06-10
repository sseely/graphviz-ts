# Failure inventory after Mission 4 (twopi)

Suite: 997 passed / 25 failed (`npx vitest run`, 2026-06-10).
dot, osage, patchwork, twopi all green (23/53 goldens... 23 of the 53
golden tests now pass: 11 dot + 6 osage + 6 patchwork + 6 twopi = 29;
24 golden failures remain + 1 unit test, circo equal-radius).

Mission 4 shipped cross-cutting infrastructure the remaining missions
inherit:

- Edge routing for the neato family: C spline_edges wrapper
  (splineEdgesShifted), EDGETYPE wiring, working bezier clipping
  (poly_inside bound, clip write-back, Center-port clip default),
  outline extents from poly-sizing.
- Component packing: polyomino packer (poly-place.ts), putGraphs
  mode dispatch, delta-semantics shiftGraphs, components parented to
  the real root (attrs visible).
- Undirected edge titles (`--`).

Remaining engines: their layouts still place nodes wrongly (heights
far off), so edge-level diffs are hidden behind that.

## circo (+ unit test equal-radius)

| Test | First diff | Actual | Expected |
|---|---|---|---|
| circo-biconn | `svg/@height` | 75 | 148 |
| circo-disconnected | `svg/@height` | 92 | 276 |
| circo-html-label | `svg/@height` | 111 | 242 |
| circo-record | `svg/@height` | 92 | 222 |
| circo-simple | `svg/@height` | 105 | 252 |
| circo-star | `svg/@height` | 44 | 273 |

## neato

| Test | First diff | Actual | Expected |
|---|---|---|---|
| neato-circle | `svg/@height` | 224 | 252 |
| neato-cluster | `svg/@height` | 179 | 134 |
| neato-diamond | `svg/@height` | 179 | 132 |
| neato-disconnected | `svg/@height` | 269 | 254 |
| neato-polygon | `svg/@height` | 179 | 134 |
| neato-simple | `svg/@height` | 224 | 169 |
| neato-weighted | `svg/@height` | 224 | 222 |

## fdp

| Test | First diff | Actual | Expected |
|---|---|---|---|
| fdp-cluster | `svg/@height` | 44 | 162 |
| fdp-disconnected | `svg/@height` | 45 | 245 |
| fdp-edge-both | `svg/@height` | 45 | 143 |
| fdp-large | `svg/@height` | 46 | 443 |
| fdp-nested-cluster | `svg/@height` | 45 | 224 |
| fdp-simple | `svg/@height` | 45 | 189 |

## sfdp

| Test | First diff | Actual | Expected |
|---|---|---|---|
| sfdp-disconnected | `svg/@height` | 4000 | 872 |
| sfdp-large | `svg/@height` | 2423 | 724 |
| sfdp-medium | `svg/@height` | 1080 | 550 |
| sfdp-simple | `svg/@height` | 200 | 301 |
| sfdp-weighted | `svg/@height` | 572 | 486 |
