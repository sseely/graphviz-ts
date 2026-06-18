# Architecture Decisions

## AD-1: faithful transpose_step (reverse condition + valid + candidate)

**Context:** Three divergences in the transpose phase (see README).

**Decision:** Port `transpose`/`transpose_step` exactly:
- Swap condition `c1 < c0 || (c0 > 0 && reverse && c1 === c0)` using
  count-based c0/c1 from `transposeCounts` (not the signed delta).
- `candidate` flag: set false at step start; on swap mark r, r±1 candidate;
  outer loop runs while `delta >= 1`.
- `valid` invalidation: on swap set the ROOT graph's ranks r, r±1
  `valid = false` (C uses `GD_rank(Root)`, not `g`, for valid).

**Consequences:** Matches C bit-for-bit on transpose. The `valid` fix
corrects stale `ncross()` after transpose. Goldens must stay byte-identical.

## AD-2: trajectory-diff is the discovery method

**Context:** Many mincross components could diverge subtly; reading alone is
insufficient.

**Decision:** Instrument both C and TS to dump `ncross` after each
`mincross_step` iteration on `tests/2471.dot` (and smaller reproducers).
Where the trajectories first diverge identifies the buggy component. Fix,
re-diff, repeat.

**Consequences:** Grounds Batch 3 in C ground truth rather than speculation.

## AD-3: goldens are byte-exact from C — a churn means a bug

**Context:** Goldens are generated from the C binary. A faithful fix should
keep them byte-identical.

**Decision:** If a fix that provably matches C churns a golden, the golden
was generated before the gap existed or is stale — regenerate it from the C
oracle and document in the journal. Otherwise a churn means the fix is wrong.

## AD-4: performance — match C's work, then optimize the hot path

**Context:** C does ~1750 transpose passes on 2471 in 2.78s; the TS does the
same passes far slower.

**Decision:** First ensure the TS does the SAME amount of work as C (the
correctness fixes reduce wasted work from the reverse bug + stale cache).
Then profile (`node --prof` on the esbuild bundle, per
[[v8-prof-for-hangs]]) and optimize the hot path (`transposeCounts`,
`ncross`) without changing output. Target: 2471 completes in seconds-to-tens.

**Consequences:** Output-preserving optimization only; the trajectory diff
and goldens guard against behavior change.

## AD-5: rollback / compatibility

Reversible — revert the merge. No data/API/schema change. Correctness fixes
bring the TS closer to C; perf changes are output-preserving.
