<!-- SPDX-License-Identifier: EPL-2.0 -->

# 2796 cluster-layout divergence — pre-mission baseline (2026-07-02)

`tests/2796.dot` (`rankdir=LR`, 43 clusters, 58 nodes). Corpus id: `2796` —
`diverged`, `firstDiffPath svg/g[1][childCount]` (parity maxΔ 62.57 is
compareSvg childCount blindness; real deltas below).

> **Visual side-by-side (DOT source, golden-vs-ours, delta table):**
> [`2796-cluster-ranking.html`](2796-cluster-ranking.html) — open in a browser.
> Rendered SVGs: [`2796-golden.svg`](2796-golden.svg) (native dot, headless
> /tmp/ghl), [`2796-ours.svg`](2796-ours.svg) (graphviz-ts).

## The two sides

| | native C (golden) | graphviz-ts (ours) |
|---|---|---|
| exit | **1** (`trouble in init_rank` ×~90 lines, then `lost 3 16 edge`) | 0, silent |
| canvas | 1943 × 2950 | 1938 × 2888 |
| nodes | 58 | 58 |
| edges | **212** (loses `3->16` to a `Pshortestpath` triangulation failure) | **213** (routes `3->16`) |
| clusters | 43 (with **overlaps** — the upstream-reported symptom) | 43 |
| layout state | NS `init_rank` infeasibility → **error-recovery layout** | clean NS solve |

## Measured deltas (per-element, title-keyed)

- **All 58 nodes differ**; median Δ 93.2, worst Δ ≈ 724 (nodes `41`, `40`,
  `53`, `49`, `42`, `38`, `37` — a whole cluster block displaced).
- **All 213 port edges differ**; worst Δ ≈ 747 (`39->5`), **101 edges have
  different piece counts** — downstream of the node displacement, not a
  routing-class defect.
- Extra element: `edge 3->16` drawn by the port only (C loses it — same
  lost-edge class the 1332 mission ported; expected to reproduce
  automatically once corridors match).

## Issue #2796 expectations vs both sides (measured 2026-07-02)

| expectation (reporter + xfail test) | native C | graphviz-ts |
|---|---|---|
| no `trouble in init_rank` | ✗ (~90 diagnostic lines) | ✓ silent |
| no triangulation failure / lost edges | ✗ loses `3->16` (14.0.5 lost `54 22` — unstable debris) | ✓ 213/213 routed |
| no overlapping clusters | ✗ **5 overlapping pairs** (worst: cluster_15/22 by 315×91pt, bbox check) | ✓ **0 pairs** |

The port already satisfies every expectation in the report; the divergence
is that it does NOT reproduce the oracle's bug. Caution: T1 layer (a) must
still verify the port's NS inputs match C's — a clean solve from *different*
constraint inputs would be right-by-accident and could mislay other cluster
graphs silently.

## Upstream status (changes the conformance question)

GitLab **#2796 is an OPEN upstream bug** (reported Dec 2025 vs graphviz
14.0.5; test added in commit `6da78b364` as `xfail(strict=True)`:
*"Graphviz should be able to triangulate the points in this graph"*).
Reporter links it to **#2471** — the same cluster-ranking blocker in project
memory. The golden side of this page is therefore an **acknowledged-broken
recovery layout** (overlapping clusters, lost edge), not intended output.
The mission's D2 checkpoint decides, after diagnosis, whether conformance
means replicating that recovery state (byte-match-is-the-bar) or an honest
accepted classification citing the upstream xfail.

## Reproduce

```sh
GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg \
  ~/git/graphviz/tests/2796.dot > golden.svg   # exit 1, stderr noisy — normal
TSX_BIN=$(ls ~/.npm/_npx/*/node_modules/.bin/tsx | head -1)
GVBINDIR=/tmp/ghl $TSX_BIN test/corpus/render-one.ts \
  ~/git/graphviz/tests/2796.dot dot > ours.svg
```
