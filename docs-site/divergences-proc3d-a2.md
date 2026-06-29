<!-- SPDX-License-Identifier: EPL-2.0 -->

# proc3d — the canonical A2 font-metric divergence

**Accepted delta — structural-match.** `proc3d` (`graphs-proc3d` /
`share-proc3d` / `windows-proc3d`) is the textbook
[A2 font-metric](/divergences#a2-text-measurement-font-metrics-label-driven-layout)
case: a sub-pixel text-measurement difference shifts node x-positions by a few
points, and the graph stays **structural-match**. This page is the standalone
work-up referenced from the divergences list.

## Input

| | |
|---|---|
| **Engine** | `dot` |
| **Source** | `tests/graphs/proc3d.gv` (from the upstream [Graphviz](https://gitlab.com/graphviz/graphviz/-/blob/main/tests/graphs/proc3d.gv) test corpus) — 443 lines |
| **Key attrs** | `fontname=Courier`, `orientation=land`, `size="10,7.5"`, `ranksep=1.0` |

## Why it diverges (root cause)

The x-network-simplex layout is faithful; the only difference is that the port's
font measurer reports some **wide labels** a fraction of a point wider than
FreeType. proc3d's widest labels are the file-path ovals — e.g.
`/home/ek/work/src/lefty/lefty.c`, the exact string
[`known-divergences.md` §A2](/divergences#a2-text-measurement-font-metrics-label-driven-layout)
measures at **+0.75 pt (+0.43%)**. A wider label makes a slightly wider node,
whose half-width feeds the `ROUND()`-ed left-to-right separation constraints; the
network simplex then picks a marginally different (equally optimal) integer
x-assignment. The result is a near-uniform **≤ 3.55 pt** x-shift over a ~2620 pt
drawing — rank, order, topology and y-coordinates identical.

## The delta — golden vs ours, overlaid

Golden (**green**) and ours (**red**) superimposed in the same frame. At full
scale they blend to brown — the shift is sub-perceptual (hence
*structural-match*).

![proc3d golden-vs-ours overlay, full drawing: green = C, red = graphviz-ts](/img/proc3d-overlay.svg)

Zoomed, the green/red fringe appears **almost entirely on the long file-path oval
labels** — exactly the wide strings the measurer over-measures. The code/box
nodes stay coincident:

![proc3d overlay zoomed on the wide path-label ovals: green = C, red = graphviz-ts](/img/proc3d-overlay-zoom.png)

## Full drawings — golden first, ours second

| Golden — native `dot` | Ours — graphviz-ts |
|---|---|
| ![proc3d rendered by C Graphviz](/img/proc3d-golden.svg) | ![proc3d rendered by graphviz-ts](/img/proc3d-ours.svg) |

## Numbers

| metric | value |
|---|---|
| verdict | structural-match |
| maxDelta (port vs native) | 3.55 pt |
| labels shifted in x | 73 / 73 (near-uniform) |
| drawing x-extent | ~2620 pt → shift is 0.13% |
| rank / order / topology / y | identical to C |

## Reproduce

The native oracle runs under the headless `GVBINDIR` (`/tmp/ghl`, from
`test/corpus/gen-headless-gvbindir.sh`) so both sides use the same
`estimate_textspan_size` measurer — see
[§A2 “Isolating the algorithm from the font backend”](/divergences#a2-text-measurement-font-metrics-label-driven-layout).

```sh
# port
GV_TEXT_MEASURER=estimate \
  npx tsx test/corpus/render-one.ts ~/git/graphviz/tests/graphs/proc3d.gv dot

# native C oracle (headless, estimate measurer)
GVBINDIR=/tmp/ghl \
  ~/git/graphviz/build/cmd/dot/dot -Tsvg ~/git/graphviz/tests/graphs/proc3d.gv
```
