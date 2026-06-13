# Failure inventory after Mission 3 (patchwork)

Suite: 990 passed / 32 failed (`npx vitest run`, 2026-06-10).
All osage + patchwork goldens PASS; 11 dot goldens green.
Remaining: 30 golden failures (twopi 6, circo 6, neato 7, fdp 6,
sfdp 5) + 2 unit tests (circo equal-radius, twopi hub-at-origin).

First diffs are unchanged from baseline-after-m2.md for every
remaining family (fdp ±1pt jitter on two tests aside):

## twopi

| Test | First diff | Actual | Expected |
|---|---|---|---|
| twopi-chain | `svg/g[1]/g[1]/ellipse[1]/@cy` | -306 | -18 |
| twopi-disconnected | `svg/@height` | 248 | 227 |
| twopi-ranksep | `svg/@height` | 181 | 318 |
| twopi-root-attr | `svg/g[1]/g[3][childCount]` | 1 | 2 |
| twopi-star | `svg/g[1]/g[3][childCount]` | 1 | 2 |
| twopi-tree | `svg/g[1]/g[3][childCount]` | 1 | 2 |

## circo

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
