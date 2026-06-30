# Architecture decisions

## AD-1 — Verify the vStart fix on SMALL windowed repros before 2471
- **Context:** 2471 hangs with the fix, so it can't be the inner loop.
- **Decision:** Build a small multi-component graph and a small multi-cluster
  graph (both forcing `vStart>0` on some rank). Compare their mincross order to
  C with the fingerprinted dump.
- **Consequence:** If a small windowed graph diverges/dups → Layer 2 is a
  `reorder` port bug with a fast loop. If all small repros are conformant →
  Layer 2 is scale/density-dependent and must be diagnosed on 2471. Either way
  the search space collapses.

## AD-2 — Fingerprint virtuals; never trust the blind `_v` dump
- **Decision:** Dump virtuals as `v[upReal>downReal|clust]` (walk in/out chains
  to the nearest real node; tag owning cluster).
- **Consequence:** `_v` dumps false-match (hid this bug for two missions). The
  fingerprint catches virtual/leader reordering.

## AD-3 — Treat the oscillation as duplicate `ND_order` until disproven
- **Context:** Parent's hang = "duplicate node orders within a rank the swap
  test can never resolve"; 270 dups observed uncapped this session.
- **Decision:** First diagnostic = per-rank/per-step dup-order + order!=index
  detector; find the first creating operation and trace it.
- **Consequence:** Focused start. If no dups at the divergence point, pivot to a
  direct C↔TS order comparison at the first oscillating transpose.

## AD-4 — `port.p.x` tiebreak is NOT assumed to be the fix
- **Context:** C `in_cross`/`out_cross` tiebreak on `port.p.x` only on equal
  order; on 2471 `px==order==0` so it's a no-op; parent tried it, didn't fix.
- **Decision:** Do not start from the tiebreak. Only revisit if diagnosis points
  there with evidence.

## AD-5 — Pre-authorized write-set
- **Decision:** `{ src/layout/dot/mincross-order.ts, src/layout/dot/mincross-cross.ts,
  src/layout/dot/mincross-order.test.ts, src/layout/dot/mincross-cross.test.ts }`
  plus this plan dir. Layer 2 most likely lands in `mincross-cross.ts`
  (transpose / transposeCounts).
- **Consequence:** No mid-flight STOP for write-set widening (parent hit that).
  Any file outside this set still triggers a STOP.

## AD-6 — Branch + merge commit
- **Decision:** `feature/mincross-2471-faithful`; merge (not squash) to main.
- **Consequence:** Per-task commit IDs referenced in the journal survive.

## Stop conditions

- Same code site changed **3×** without closing the order diff / convergence.
- Layer-2 root cause not localized within **2 diagnostic rounds** → STOP,
  document the findings, leave the tree reverted (mirror this session's outcome).
- A fix makes any passing reproducer diverge, or churns any golden → STOP/revert.
- A fix needs a file outside the AD-5 write-set → STOP for authorization.
- 2471 still hangs after the Layer-2 fix attempt → STOP (never leave a hang).
- C instrumentation cannot be reverted cleanly → STOP.

## Push-forward (decide alone)

- Re-applying the documented vStart fix (T1) — mechanical, just do it.
- Reverting C instrumentation, rebuilding `gvplugin_dot_layout` + `/tmp/gvmine`.
- Choosing the specific small graphs for the windowed reproducers.
- Adding diagnostic probes/dumps (temporary, reverted).
