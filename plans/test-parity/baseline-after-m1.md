# Failure inventory after Mission 1 (node sizing)

Suite: 978 passed / 44 failed (`npx vitest run`, 2026-06-10, commit
aa9a988). The failure SET is identical to [baseline.md](baseline.md)
(no test fixed outright, none regressed; +21 passes are the new
poly-sizing unit tests). All 11 dot goldens stayed green with
label-driven sizing routed through them.

What mission 1 changed inside the still-failing tests:

- **twopi-star, twopi-root-attr**: node-sizing first diff
  (`ellipse@rx` 27 vs 33.44) is FIXED; first diff is now the same
  edge-group structural diff twopi-tree already had.
- **circo-html-label**: height 91 → 111 (closer to 242).
- **circo-record**: height 91 → 92 (marginal).
- All other families: first diffs numerically unchanged (their node
  labels are small, so sizing was already at defaults).

## osage (unchanged from baseline)

| Test | First diff | Actual | Expected |
|---|---|---|---|
| osage-array-mode | `svg/@height` | 96 | 88 |
| osage-empty-cluster | `svg/@height` | 96 | 113 |
| osage-labels | `svg/@height` | 96 | 113 |
| osage-nested | `svg/@height` | 200 | 250 |
| osage-simple | `svg/@height` | 96 | 88 |
| osage-sortv | `svg/@height` | 96 | 88 |

## patchwork (unchanged from baseline)

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
| twopi-root-attr | `svg/g[1]/g[3][childCount]` (was ellipse@rx) | 1 | 2 |
| twopi-star | `svg/g[1]/g[3][childCount]` (was ellipse@rx) | 1 | 2 |
| twopi-tree | `svg/g[1]/g[3][childCount]` | 1 | 2 |

Plus unit test `src/layout/twopi/twopi.test.ts` (hub at origin).

## circo

| Test | First diff | Actual | Expected |
|---|---|---|---|
| circo-biconn | `svg/@height` | 75 | 148 |
| circo-disconnected | `svg/@height` | 92 | 276 |
| circo-html-label | `svg/@height` | 111 (was 91) | 242 |
| circo-record | `svg/@height` | 92 (was 91) | 222 |
| circo-simple | `svg/@height` | 105 | 252 |
| circo-star | `svg/@height` | 44 | 273 |

Plus unit test `src/layout/circo/circo.test.ts` (equal radius).

## neato (unchanged from baseline)

| Test | First diff | Actual | Expected |
|---|---|---|---|
| neato-circle | `svg/@height` | 224 | 252 |
| neato-cluster | `svg/@height` | 179 | 134 |
| neato-diamond | `svg/@height` | 179 | 132 |
| neato-disconnected | `svg/@height` | 269 | 254 |
| neato-polygon | `svg/@height` | 179 | 134 |
| neato-simple | `svg/@height` | 224 | 169 |
| neato-weighted | `svg/@height` | 224 | 222 |

## fdp (unchanged from baseline)

| Test | First diff | Actual | Expected |
|---|---|---|---|
| fdp-cluster | `svg/@height` | 45 | 162 |
| fdp-disconnected | `svg/@height` | 45 | 245 |
| fdp-edge-both | `svg/@height` | 44 | 143 |
| fdp-large | `svg/@height` | 46 | 443 |
| fdp-nested-cluster | `svg/@height` | 45 | 224 |
| fdp-simple | `svg/@height` | 45 | 189 |

## sfdp (unchanged from baseline)

| Test | First diff | Actual | Expected |
|---|---|---|---|
| sfdp-disconnected | `svg/@height` | 4000 | 872 |
| sfdp-large | `svg/@height` | 2423 | 724 |
| sfdp-medium | `svg/@height` | 1080 | 550 |
| sfdp-simple | `svg/@height` | 200 | 301 |
| sfdp-weighted | `svg/@height` | 572 | 486 |
