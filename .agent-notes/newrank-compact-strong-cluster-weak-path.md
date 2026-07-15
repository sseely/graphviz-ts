# Observation: `newrank` + `compact=true` cluster (C's weak()/strong-cluster path) — FIXED

- **Context**: While fixing the newrank/minlen=0 aux-edge calloc bug
  ([[newrank-minlen0-aux-edge-calloc]]), I found the weak-constraint path was
  reachable **only** when a cluster sets `compact=true` (C's
  `is_a_strong_cluster(g)` is `mapbool(agget(g,"compact"))`, rank.c:562), and
  `compact=` appears in ZERO corpus graphs and ZERO goldens — an entirely
  unexercised path.

- **Finding (root cause, instrumented on both sides)**: `newrank` + two compact
  clusters diverged — port ranked 5 levels where the oracle ranks 3. I dumped
  the Xg constraint graph from BOTH the port and an instrumented C oracle:

  - C's Xg: ONE `top` node, ONE `bot` node, ONE `top->bot ml=0 w=2000` edge.
  - Port's Xg: TWO `top->bot` edges (w=1000 each), backed by TWO distinct `top`
    node objects and TWO `bot` objects that merely share the name `\x7ftop` /
    `\x7fbot`.

  ORIGIN: **`makeXnode` did not dedup by name.** C's `makeXnode` is
  `agnode(G, name, 1)` (rank.c:729), which returns the EXISTING node when one
  with that name is present. `compile_clusters` calls `makeXnode(Xg, TOPNODE)`
  once per strong cluster, so in C all strong clusters share a single TOP/BOT.
  The port did `new NodeClass` every call, giving each cluster its own TOP/BOT.
  That split the `STRONG_CLUSTER_WEIGHT` across two half-weight edges (and two
  disjoint skeleton nodes), so the network-simplex solve settled on a
  suboptimal, taller ranking. Real node names and `_weak_N` names are unique, so
  the dedup only ever affects TOP/BOT/ROOT — exactly as in C.

  SECOND, dependent defect: even with shared TOP/BOT, the `top->bot` edge was
  created with a bare `xgAddEdge` (no dedup), so the second cluster forked a
  parallel edge instead of merging weight. C's `agedge(Xg, top, bot)` on an
  `Agstrictdirected` graph returns the existing edge and `merge()` accumulates.
  Fixed with find-or-add at the one cluster-skeleton call site.

  MY FIRST HYPOTHESIS WAS WRONG and evidence refuted it: I first fixed only the
  edge dedup, re-probed, and it STILL diverged (identical 135 diffs) — because
  the two TOP nodes were different objects, so the edge find never matched. The
  node-level dedup in makeXnode is the actual origin; the edge dedup is
  load-bearing only once the nodes are shared. Both are required.

  NOTE (deliberate, faithful deviation): C re-runs the Last_node threading even
  when makeXnode returns an existing node. The port skips it (returns early).
  Re-threading an already-linked node would corrupt the port's doubly-linked
  nlist, and the reorder is not observable in output for the TOP/BOT helpers —
  verified: w1-w5 all byte-match the oracle.

- **Impact**: Closes the strong-cluster/weak-edge rank path, which had zero
  oracle coverage. dot-only (`dot2Rank`), and provably corpus-neutral (no corpus
  graph sets `compact`), so the dot survey conformant count is unchanged.

- **Confidence**: High. Root cause dumped from instrumented C vs port; fix
  probed PASS on 5 configs (single, two-cluster weak, three-cluster weight
  accumulation, nested, compact+plain mix); full vitest green.
