<!-- SPDX-License-Identifier: EPL-2.0 -->

# proc3d — the canonical A2 font-metric divergence (historical)

::: tip Status: resolved — proc3d is now conformant
As of the `EstimateTextMeasurer` cutover (`239c51b`, 2026-06-25), both the
port and the headless C oracle measure text with the same
`estimate_textspan_size` model.
Re-running the reproduction below against the current tree returns **0 diffs,
maxDelta 0** for `tests/graphs/proc3d.gv` — the delta documented on this page
no longer reproduces. The A2 class as a whole has **collapsed** for the
corpus's proc3d instances; see [Known divergences §A2](/divergences#a2-text-measurement-font-metrics-label-driven-layout)
and [Parity](/parity) for current, non-frozen counts. This page is kept as the
historical root-cause writeup — the mechanism below is real and instructive,
it simply no longer produces an observable delta on this graph.
:::

`proc3d` (`graphs-proc3d` / `share-proc3d` / `windows-proc3d`) was the
textbook [A2 font-metric](/divergences#a2-text-measurement-font-metrics-label-driven-layout)
case: a sub-pixel text-measurement difference shifted node x-positions by a
few points, landing the graph at **structural-match**. This page is the
standalone work-up referenced from the divergences list, describing *why* that
happened before the measurers were unified.

## Input

| | |
|---|---|
| **Engine** | `dot` |
| **Source** | `tests/graphs/proc3d.gv` (from the upstream [Graphviz](https://gitlab.com/graphviz/graphviz/-/blob/main/tests/graphs/proc3d.gv) test corpus) — 443 lines |
| **Key attrs** | `fontname=Courier`, `orientation=land`, `size="10,7.5"`, `ranksep=1.0` |

## Why it diverged (root cause, at the time)

The x-network-simplex layout was faithful; the only difference was that the
port's font measurer of that era reported some **wide labels** a fraction of
a point wider than the native oracle's FreeType-backed measurement. proc3d's
widest labels are the file-path ovals — e.g. `/home/ek/work/src/lefty/lefty.c`,
the exact string [`known-divergences.md` §A2](/divergences#a2-text-measurement-font-metrics-label-driven-layout)
measured at **+0.75 pt (+0.43%)**. A wider label made a slightly wider node,
whose half-width fed the `ROUND()`-ed left-to-right separation constraints; the
network simplex then picked a marginally different (equally optimal) integer
x-assignment. The result was a near-uniform **≤ 3.55 pt** x-shift over a
~2620 pt drawing — rank, order, topology and y-coordinates identical. The fix
was not a proc3d-specific patch: the `EstimateTextMeasurer` cutover put both
sides on the same headless measurement model, which eliminated the
wide-label-over-measurement gap that drove this shift.

## The delta — golden vs ours, overlaid

Golden (**green**) and ours (**red**) superimposed in the same frame. At full
scale they blend to brown — the shift is sub-perceptual (hence
*structural-match*).

![proc3d golden-vs-ours overlay, full drawing: green = C, red = @knowvah/dot-engine](/img/proc3d-overlay.svg)

Zoomed, the green/red fringe appears **almost entirely on the long file-path oval
labels** — exactly the wide strings the measurer over-measures. The code/box
nodes stay coincident:

![proc3d overlay zoomed on the wide path-label ovals: green = C, red = @knowvah/dot-engine](/img/proc3d-overlay-zoom.png)

## Full drawings — golden first, ours second

| Golden — native `dot` | Ours — @knowvah/dot-engine |
|---|---|
| ![proc3d rendered by C Graphviz](/img/proc3d-golden.svg) | ![proc3d rendered by @knowvah/dot-engine](/img/proc3d-ours.svg) |

## Numbers (at the time this page was written)

| metric | value |
|---|---|
| verdict | structural-match |
| maxDelta (port vs native) | 3.55 pt |
| labels shifted in x | 73 / 73 (near-uniform) |
| drawing x-extent | ~2620 pt → shift is 0.13% |
| rank / order / topology / y | identical to C |

**Current numbers** (re-verified against the live tree): verdict
**conformant**, 0 diffs, maxDelta 0 — see the status note at the top of this
page. The overlay images above are kept as a snapshot of the mechanism, not
as a live comparison.

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

Running this today produces matching SVGs (0 diffs at the `deterministic`
±0.01 tolerance) rather than the 3.55pt delta described above.
