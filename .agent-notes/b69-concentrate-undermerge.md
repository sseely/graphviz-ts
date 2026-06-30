# b69 is a REAL divergence (concentrate under-merge) — NOT accepted A2

> **UPDATE (2026-06-24, troubleshooting pass):** the under-merge is the *tip* of a
> bigger issue — the `concentrate` attribute was **never plumbed**, so the whole
> feature was dead. Activation + the first two fixes (flag wiring + a concSlope
> crash) live on branch `feature/activate-concentrate` (87b4e97). b71 now
> conforms to; b15 crashes on the cluster path; b69/b135/b62 still under-merge.
> Full plan + remaining bugs: `plans/activate-concentrate/README.md`. The
> original under-merge analysis below remains the lead for Bug 4.

## Observation: b69 diverged 116.69 — port's concentrate merges 3 fewer edges than C
- **Context**: Building "accepted A2" visuals for the divergences doc. The doc
  listed `b69` alongside `proc3d` as a label-heavy graph that "stays at
  structural-match." Verified against the oracle — the doc was WRONG.
- **Finding**: `graphs-b69` verdict is **`diverged`, maxDelta 116.69** (not
  structural-match). Root cause is **NOT font metrics (A2)**:
  - Node box WIDTHS match C exactly (e.g. MRS100-LOAD-WR1FC1 = 164.5 in both) —
    so it is not the A2 text-measurement delta.
  - Element counts differ: ours **140 edges / 188 polygons** vs golden
    **137 / 181**; SVG width ours **461pt** vs golden **433pt**; node positions
    shift up to ~17pt and y by ~214pt on node1.
  - `b69.gv` has `concentrate="true"`. Edge-title set diff shows **3 edges
    present in OURS but merged away by C** (only-in-ours = 3, only-in-golden = 0):
    1. `MRS380-LOAD-WRCLS1_TEMP -> WRCLS1`
    2. `WS-BATCH-DATE -> MRS145-UPD-DATEFILE`
    3. `MRS225-UPD-WR1MF1-WT -> WAR-WR1MF1`
  - i.e. the port's **concentrate UNDER-merges** by 3 edges; the extra edges
    perturb ranking/positioning → the 116.69 divergence.
- **Impact**: b69 is a tracked element-count/concentrate bug to FIX, not an
  accepted delta. Removed from `docs/known-divergences.md` §A2 (2026-06-24).
  Decisive troubleshooting lead for a future mission.
- **Where to look**: `src/layout/dot/conc.ts:357 dotConcentrate` and the
  `mergeable` predicate `src/layout/dot/classify.ts:250` (@see
  lib/dotgen/class2.c:mergeable, lib/dotgen/conc.c). Compare the port's merge
  decision vs C `dot_concentrate` for those 3 specific edges — likely a
  `mergeable()` / same-rank-window / rebuild_vlists difference.
- **Confidence**: High (oracle edge-set diff + width match + element counts).

## Repro / evidence recipe
```
DOT=~/git/graphviz/build/cmd/dot/dot
GVBINDIR=/tmp/gvplugins $DOT -Tsvg ~/git/graphviz/tests/graphs/b69.gv -o /tmp/b69-c.svg
GVBINDIR=/tmp/gvplugins npx tsx test/corpus/render-one.ts \
  ~/git/graphviz/tests/graphs/b69.gv dot > /tmp/b69-ts.svg
# diff edge <title> sets: the 3 only-in-ours edges are the un-merged ones.
```
