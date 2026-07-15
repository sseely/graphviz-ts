# Observation: newrank=true silently ignores minlen=0 (dot2 aux-graph edges are not calloc-zeroed)

- **Context**: Risk-weighted triple fixtures in the rank x cluster x
  component-projection danger zone. `t11-newrank-cluster-ranksame` diverged
  (229 diffs). Bisection collapsed it to a 3-line graph with no cluster and no
  rankset at all.

- **Finding**: **`newrank=true` + any `minlen=0` edge diverges.** Minimal repro:

  ```
  digraph G { newrank=true; a -> b [minlen=0]; b -> c; }
  ```

  Oracle: 2 ranks (a,b flat on rank 0 — minlen=0 honored — c on rank 1), bb
  height 108. Port: 3 ranks (a,b,c stacked — minlen=0 lost), bb height 180.
  Delta is exactly one rank (72pt). The same graph **without** `newrank` passes,
  so dot1 honors minlen=0 and only the dot2/newrank path loses it.

  MECHANISM, at its origin: `src/layout/dot/rank-dot2.ts:102 xgAddEdge` creates
  aux-graph (Xg) edges via `new EdgeClass(...)`, leaving `info.minlen` and
  `info.weight` **undefined**. C creates the same edges with `agedge(Xg,...)` on
  a **calloc'd** struct, so `ED_minlen == 0` and `ED_weight == 0` — NOT the
  user-edge defaults of 1. The accessors (`rank-dot2.ts:34,35`)
  `eMinlen = info.minlen ?? 1` / `eWeight = info.weight ?? 1` therefore hand back
  1 where C has 0, and `xgMerge` (rank.c:merge) computes
  `MAX(eMinlen(e)=1, minlen=0) = 1` where C computes `MAX(0,0) = 0`.

  `?? 1` is the correct default for a USER edge — `init.ts:189` sets
  `e.info.minlen = lateInt(attr, 1, 0)` on every one (mirroring C's
  `dot_init_edge`, dotinit.c:85) — so the fallback can only ever fire for Xg
  edges, i.e. exactly where it is wrong. This is the calloc-zero-vs-undefined
  port hazard.

  THREE manifestations of the one root cause:
  1. `xgStrong`/`xgMerge` — minlen=0 clobbered to 1 (the observed bug).
  2. `xgWeakSetWeights` — `Math.max(eMinlen(e), 0)` yields 1; C annotates the
     same line `/* effectively a nop */` **because** ED_minlen is 0 there.
  3. `compileClusters` top/bot edges — created and never merged, so in C they
     keep minlen=0/weight=0; the port's NS solve reads them back as 1/1.

  ALREADY BAND-AIDED ONCE: `xgWeakSetWeights` carries a literal `- 1` on both
  weight lines, which exists only to cancel `eWeight`'s bogus 1-default. That is
  a compensation at the symptom. Fixing the origin **requires removing those two
  `- 1`s**, or weak-edge weights go one under C.

- **Impact**: `newrank` + `minlen=0` is a dark conjunction — 0 upstream corpus
  graphs pair them, which is why thousands of sweep-ids never caught it. Fix at
  the origin: `xgAddEdge` must set `minlen = 0, weight = 0` to mirror calloc.

- **Confidence**: High. Mechanism traced to C (rank.c:761 merge, 767 strong,
  798 weak; dotinit.c:85), predicted the cluster-free repro before running it,
  and the prediction held.
