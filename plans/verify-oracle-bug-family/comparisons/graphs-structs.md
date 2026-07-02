<!-- SPDX-License-Identifier: EPL-2.0 -->

# graphs-structs — oracle-bug family comparison (2026-07-02, post-fixes)

Input: `~/git/graphviz/tests/graphs/structs.gv` · corpus id `graphs-structs` · oracle = headless
native dot (`GVBINDIR=/tmp/ghl`, estimate metrics) · port = graphviz-ts at
`chore/verify-oracle-bug-family`.

> **Visual side-by-side:** [`graphs-structs.html`](graphs-structs.html) · golden:
> [`graphs-structs-golden.svg`](graphs-structs-golden.svg) · ours: [`graphs-structs-ours.svg`](graphs-structs-ours.svg)

## Verdict

**diverged, maxΔ 0 — element-tree difference only (the oracle's lost edge)**

| | native C oracle | graphviz-ts |
|---|---|---|
| stderr / exit | exit 1; `destination point not in any triangle` + `Pshortestpath failed`; loses struct1:f2→struct3:here | exit 0; silent; routes both edges |
| edges rendered | 1 / 2 (oracle / port) | — |

## Upstream status

No dedicated upstream test. Ancient record/port routing-loss family (#102, #242, #274, #1323). Existing R-oracle rules entry: stable graphviz 15.0.0 AND the port both render it — a dev-build oracle regression.

## Inputs verification (right-for-the-right-reason)

Both rank2 calls line-identical; node geometry maxΔ 0. The oracle's estimate-metric record geometry trips Pshortestpath; the port's identical geometry routes fine (different FP path through pathplan).

## Disposition

Accepted A4-family/oracle-bug for parity scope (rules scope already accepted as R-oracle).
