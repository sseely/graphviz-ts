# Failure inventory after Mission 5 (circo)

Suite: 1004 passed / 18 failed (`npx vitest run`, 2026-06-10).
dot, osage, patchwork, twopi, circo all green (35/53 goldens pass).
Remaining: 18 golden failures (neato 7, fdp 6, sfdp 5); no unit tests
left failing.

First diffs unchanged from baseline-after-m4.md:

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

## Notes for missions 6-8

- The installed Homebrew graphviz is EXACTLY 15.0.0 and byte-
  reproduces the golden refs — use it as an oracle (`circo/neato/fdp
  -v -v -v`, `-Tdot` for pos values) before reading code.
- cgraph ID-ordered subgraph iteration (mission 5 discovery) likely
  matters for neato/fdp component and cluster handling too.
- D3 (drand48 port, exact numerics) still pending — neato/fdp/sfdp
  use random initial placement; check `src/common/random.ts` exists
  before porting solvers.
