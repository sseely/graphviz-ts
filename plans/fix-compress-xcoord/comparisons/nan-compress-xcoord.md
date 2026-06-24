<!-- SPDX-License-Identifier: EPL-2.0 -->

# NaN.gv `ratio=compress` x-coordinate residual — CHARACTERIZED (accepted A2)

`tests/graphs/NaN.gv` (`orientation=landscape; ratio=compress; size="16,10"`).
Corpus ids: `graphs-NaN`, `share-NaN`, `windows-NaN` — all `diverged`.

## Before (symptom)

- 53 of 76 nodes mispositioned in **X only** (`dy=0` for all), by −5..+1 pt.
- `Target<->TThread` opposing 2-cycle splines render **7 bezier pts vs C's 4**
  (the structural diff that pins the verdict at `diverged` rather than
  `structural-match`).

## Root cause (oracle-instrumented, both sides)

Not a compress bug. The compress x-network-simplex path is **faithful**: every
constraint input matches native C —

- `compressGraph`: `flip=0 p=(1152,720) x=1152` in **both**. The width edge is
  non-binding (natural compressed width ~1907 > 1152); compression is driven by
  the weight-1000 term identically. `lib/dotgen/position.c:512`.
- `containNodes` per-rank ln/rn minlens match C on every rank but rank-0 rLen
  (100 vs 99 — itself a 1 pt node-width diff).
- aux-edge **counts identical**: LR=132, pairs=318, total=471, wt-sum=1612.
- `lrBalance` faithful (`>>1` == C `/2`; same `lim` tie-break).
- Rank **orders match C exactly** → pure x-coordinate divergence, not mincross.

The **only** diverging input is the LR-separation minlen sum (TS 11380 vs
C 11368, **+12**), caused by **9 nodes measured 0.5–1.03 pt wider than C**
(VaxFrame, VaxGCommonFrame, Wire, UFileWr, AtomWr, WrClass, ProtectedWire,
StreamWire, TextWr; half-width sum 5.65 × ~2 edges/node ≈ +11.3 ≈ +12). Those
widths come from the **shared font-metric text measurer** — the documented,
accepted **A2 divergence** (`docs/known-divergences.md`, §A2). C line
`lib/dotgen/position.c:264`: `width = ND_rw(u) + ND_lw(v) + nodesep;`.

`ratio=compress`'s weight-1000 packing makes the normally-slack separation
constraints **binding**, which is why a sub-pixel width error that is invisible
without compress surfaces here as a −3..−5 pt interior x-shift — which in turn
tips the `Target<->TThread` straight line 0.55 px past the tail-box wall, so
`shortestPath` bends and emits the extra bezier piece.

## Proof (forcing experiment)

Temporarily overriding the 9 nodes' `lw`/`rw` to C's values (forcing the only
diverging input to match) yields:

| metric | port (as-is) | port (forced C widths) | native C |
|---|---|---|---|
| nodes off in X (|dx|>0.5) | **53 / 76** | **0 / 76** | — |
| `Target→TThread` spline pts | 7 | **4** | 4 |
| `TThread→Target` spline pts | 7 | **4** | 4 |

So the compress x-coord path reproduces C exactly once the font-metric width
inputs match; the entire residual is upstream font metrics.

## Resolution — characterized, not fixed

No in-scope fix exists. The two levers are both out of scope:
- **font metrics** — a shared primitive every corpus label flows through;
  adjusting it to win these strings risks regressing the hundreds of graphs that
  currently byte-match (`known-divergences.md` §A2 rationale).
- **spline router** — faithful; forbidden by the mission scope.

NaN is the same class as `proc3d`/`b69` (accepted A2), except its accumulated
x-shift happens to tip a spline **segment count**, pushing the verdict from
`structural-match` to `diverged`. Documented as an A2 instance in
`docs/known-divergences.md`. `ratio=compress` activation itself is faithful and
correct (correct dims/ranks for the 4 compress graphs) and is merged on its own
merits.

Reproduce: `GVBINDIR=/tmp/gvplugins npx tsx test/corpus/render-one.ts
~/git/graphviz/tests/graphs/NaN.gv dot` vs `GVBINDIR=/tmp/gvplugins
~/git/graphviz/build/cmd/dot/dot -Tsvg …/NaN.gv`.
