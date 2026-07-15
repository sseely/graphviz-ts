# Observation: `newrank` + `compact=true` cluster (C's weak() path) diverges — OPEN, pre-existing

- **Context**: While fixing the newrank/minlen=0 aux-edge calloc bug
  ([[newrank-minlen0-aux-edge-calloc]]), I removed two `- 1` weight
  compensations in `xgWeakSetWeights`. Checking whether that path was actually
  exercised, I found it is reachable **only** when a cluster sets
  `compact=true`: C's `is_a_strong_cluster(g)` is literally
  `mapbool(agget(g, "compact"))` (rank.c:562), and `compile_edges` calls
  `weak()` instead of `strong()` only when a cross-cluster edge touches a strong
  cluster (rank.c:834).

- **Finding**: **`compact=` appears in ZERO upstream corpus graphs and ZERO
  goldens.** The entire weak-constraint path is unexercised by every test we
  have. A minimal probe diverges:

  ```
  digraph G {
    newrank=true;
    subgraph cluster0 { compact=true; label="C0"; a -> b [minlen=0]; b -> c; }
    subgraph cluster1 { compact=true; label="C1"; p -> q; }
    c -> p;
    a -> q [minlen=0];
    q -> z;
  }
  ```

  Oracle bb 236 x 220.8; port is taller and narrower (too many ranks again).
  **PRE-EXISTING, not caused by the calloc fix**: diverges on pristine HEAD
  (155 diffs) *and* with the fix (135 diffs — the fix improves it but does not
  close it). Kept OUT of the golden manifest: a failing fixture cannot be a
  golden, and this needs its own mechanism + gate rather than being bundled into
  an unrelated commit.

  CONCRETE LEAD (found by reading, not yet proven to be the whole cause): C's
  `weak()` (rank.c:786) tests only **`agfstout(g, v)`** — the *first* out-edge of
  the shared tail `v`:

  ```c
  for (e = agfstin(g, t); e; e = agnxtin(g, e)) {
      v = agtail(e);
      if ((f = agfstout(g, v)) && aghead(f) == h) return;   /* existing diamond */
  }
  ```

  The port's `xgWeakExists` (rank-dot2.ts) scans **every** out-edge of `v`:

  ```ts
  for (const f of Xg.edges) { if (f.tail === v && f.head === h) return true; }
  ```

  So the port recognises a "diamond" C would miss, and therefore *skips creating
  a weak edge that C creates*. Suspect this is at least part of the divergence.
  Do not assume it is all of it — `compile_clusters` also gates its TOP/BOT
  edges on `is_a_strong_cluster` (rank.c:850), which is equally unexercised.

- **Impact**: A whole rank-constraint path (strong clusters / weak edges) has
  never been run against the oracle. Low corpus impact (`compact` is unused
  upstream), but it is a real conformance gap and a textbook dark path.

- **Confidence**: High that it diverges and that it is pre-existing (probed both
  HEAD and the fixed tree). Medium on the `agfstout` lead being the sole cause —
  unverified, not yet instrumented.
