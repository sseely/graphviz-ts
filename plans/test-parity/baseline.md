# Baseline failure inventory (project start)

Suite: 957 passed / 44 failed (`npx vitest run`, 2026-06-10).
42 golden failures below + 2 unit tests:
`src/layout/circo/circo.test.ts` (equal radius) and
`src/layout/twopi/twopi.test.ts` (hub at origin).

First diff per test (the comparator stops at the first structural
mismatch, so deeper diffs are hidden until these are fixed):

## osage

| Test | First diff | Actual | Expected |
|---|---|---|---|
| osage-array-mode | `svg/@height` | 96 | 88 |
| osage-empty-cluster | `svg/@height` | 96 | 113 |
| osage-labels | `svg/@height` | 96 | 113 |
| osage-nested | `svg/@height` | 200 | 250 |
| osage-simple | `svg/@height` | 96 | 88 |
| osage-sortv | `svg/@height` | 96 | 88 |

## patchwork

| Test | First diff | Actual | Expected |
|---|---|---|---|
| patchwork-cluster | `svg/g[1][childCount]` | 10 | 12 |
| patchwork-default-area | `svg/g[1][childCount]` | 6 | 7 |
| patchwork-html-label | `svg/g[1][childCount]` | 5 | 6 |
| patchwork-nested | `svg/g[1][childCount]` | 12 | 14 |
| patchwork-simple | `svg/g[1][childCount]` | 7 | 8 |
| patchwork-weighted | `svg/g[1][childCount]` | 7 | 8 |

## twopi

| Test | First diff | Actual | Expected |
|---|---|---|---|
| twopi-chain | `svg/g[1]/g[1]/ellipse[1]/@cy` | -306 | -18 |
| twopi-disconnected | `svg/@height` | 248 | 227 |
| twopi-ranksep | `svg/@height` | 181 | 318 |
| twopi-root-attr | `svg/g[1]/g[1]/ellipse[1]/@rx` | 27 | 33.44 |
| twopi-star | `svg/g[1]/g[1]/ellipse[1]/@rx` | 27 | 33.44 |
| twopi-tree | `svg/g[1]/g[3][childCount]` | 1 | 2 |

## circo

| Test | First diff | Actual | Expected |
|---|---|---|---|
| circo-biconn | `svg/@height` | 75 | 148 |
| circo-disconnected | `svg/@height` | 92 | 276 |
| circo-html-label | `svg/@height` | 91 | 242 |
| circo-record | `svg/@height` | 91 | 222 |
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
| fdp-cluster | `svg/@height` | 46 | 162 |
| fdp-disconnected | `svg/@height` | 45 | 245 |
| fdp-edge-both | `svg/@height` | 44 | 143 |
| fdp-large | `svg/@height` | 46 | 443 |
| fdp-nested-cluster | `svg/@height` | 46 | 224 |
| fdp-simple | `svg/@height` | 45 | 189 |

## sfdp

| Test | First diff | Actual | Expected |
|---|---|---|---|
| sfdp-disconnected | `svg/@height` | 4000 | 872 |
| sfdp-large | `svg/@height` | 2423 | 724 |
| sfdp-medium | `svg/@height` | 1080 | 550 |
| sfdp-simple | `svg/@height` | 200 | 301 |
| sfdp-weighted | `svg/@height` | 572 | 486 |

