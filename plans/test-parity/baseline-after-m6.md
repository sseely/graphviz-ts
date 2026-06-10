# Failure inventory after Mission 6 (neato)

Suite: 1013 passed / 11 failed (`npx vitest run`, 2026-06-10).
dot, osage, patchwork, twopi, circo, neato all green (42/53 goldens).
Remaining: fdp 6, sfdp 5.

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

## Notes for missions 7-8

- Read fdpgen/sfdpgen specs at the 15.0.0 TAG (see decision journal:
  post-tag Mlimit + ULP churn).
- The installed graphviz binary == 15.0.0: use `fdp/sfdp -v`,
  `-Tplain`, `-Gmaxiter=N` bisection as the oracle workflow.
- Available shared infrastructure: src/common/random.ts (exact
  drand48), neato stress kernel + matrix-ops (float32 discipline),
  polyomino packing with spline-aware shifts, splineEdgesShifted,
  cluster bb/label machinery.
