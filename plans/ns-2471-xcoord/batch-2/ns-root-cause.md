# Root cause (FOUND) — and why it is OUTSIDE the NS write-set → STOP

## TL;DR

The brief's premise — *"the x-coord network simplex does not converge on the
**same** correct-order aux graph"* — is **falsified**. The TS network simplex
(`ns.ts` / `ns-core.ts` / `ns-range.ts`) is **faithful to `ns.c`**. The aux
graph fed to it is **not the same** as C's: TS builds **333 fewer edges**
(19695 vs C's 20028). Those 333 missing edges are **all** the left-side
constraints from `keepout_othernodes`, dropped because the TS port reads the
cluster rank's first node as `g.info.rank[r].v[0]` **without applying the
rank's `vStart` window offset** — the *identical bug class* as mincross
Layers 1 & 2, now living in the **position phase** (`position-cluster.ts`).

Because the fix is in `position-cluster.ts` (cluster keepout construction),
**outside the pre-authorised write-set `{ns.ts, ns-core.ts}`**, this is a
**STOP for write-set authorization** (per stop conditions + ADR contradiction:
the implementation contradicts the brief's NS-bug premise). NS itself needs no
change.

## Classification (Batch 1)

**Correctness/cycling, NOT faithful-but-slow** (so ADR-5 STOP does *not* apply;
the deviation is real, not a constant-factor slowdown):

| | C (native oracle) | TS |
|---|---|---|
| x-coord NS (balance=2) | 8637 nodes, **20028 edges** | 8637 nodes, **19695 edges** |
| pivots to converge | **24,543 iter / 2.20 s** | **≥500k, no convergence** (capped) |
| degenerate (slack=0) pivots | — | **~42%** |
| negative-cut tree edges over time | → 0 | **oscillates ~750–930** (thrashing) |

TS does **20×+ more pivots** than C and never converges → not "same pivots,
slower wall-clock". The `leave_edge` rotating index works correctly in TS
(`sI` rotates, maxSi=8635); the earlier "sI pinned at 0" guess was **disproven**.

## How it was localized (evidence chain)

All probes were temporary `globalThis` hooks over the esbuild bundle on
`~/git/graphviz/tests/2471.dot` (`maxphase=3` isolates position). C oracle =
native `dot -v` with `GVBINDIR=/tmp/gvmine`. **All instrumentation reverted**
(`git diff src/` empty; `git -C ~/git/graphviz status --porcelain lib/` empty).

1. **NS internals are faithful.** Line-by-line vs `ns.c`: `leave_edge`,
   `enter_edge` (+`dfs_enter_*`), `update`/`treeupdate`/`rerank` dispatch,
   `invalidate_path`, `exchange_tree_edges`, `dfs_range`/`dfs_range_init` all
   match (including tie-breaks, the rotating `S_i`, the search-size cap).
2. **Aux graph differs by 333 edges.** Probe at the x-coord `rank2` entry:
   TS nNodes=8637 (= C), nEdges=**19695** (C=**20028**).
3. **Per-stage `create_aux_edges` dump (TS vs instrumented C), filtered to the
   8637-node root graph:**

   | stage | TS edges | C edges |
   |---|---|---|
   | allocate | 0 | — |
   | makeLR | 3638 | (same path) |
   | edgePairs | **12674** | **12674** ✓ identical |
   | posClusters | **19695** | **20028** ✗ (+7021 vs +7354) |
   | compress | 19695 | 20028 |

   ⇒ TS and C are **conformant through `make_edge_pairs`**. The entire gap
   is in `pos_clusters`.
4. **Per-sub-function dump of `pos_clusters`:**

   | sub-function | TS Δedges | C Δedges |
   |---|---|---|
   | contain_clustnodes | +934 | +934 ✓ |
   | **keepout_othernodes** | **+340** | **+673** ✗ (TS short by 333) |
   | contain_subclust | +492 | +492 ✓ |
   | separate_subclust | +5255 | +5255 ✓ |

   ⇒ the whole 333-edge deficit is in **`keepout_othernodes`**.
5. **Left vs right split** (`make_aux_edge` call-site counters, both sides):
   - C: **left=333**, right=340.
   - TS: **left=0**, right=340.
   ⇒ TS's `keepoutLeft` makes **zero** edges; C makes 333.
6. **Why `keepoutLeft` makes zero edges:** its loop is
   `for (i = ND_order(v0) - 1; i >= 0; i--)`. A probe shows
   `nodeOrder(v0) === 0` for **every** cluster rank, so the loop never runs
   (start index = -1). Further probing:
   - `keepout_othernodes` recursion reaches clusters fine (root calls=23,
     cluster calls=344).
   - For cluster calls, `v0 = g.info.rank[r].v[0]` has `order=0` **and is the
     same object as `root.info.rank[r].v[0]` (inRoot=0)** — i.e. the cluster's
     "first node" is wrongly the *root rank's* leftmost node.
   - `cluster.ts:142` sets `subg.info.rank[r].vStart = ipos`; the cluster rank's
     `.v` is the **shared root array**, addressed via `rankGet` (which adds
     `vStart`). `keepoutLeft`/`keepoutRight` read `.v[0]` / `nodeOrder(v0)`
     **directly, ignoring `vStart`** → they see the root's node 0, not the
     cluster's node at `.v[vStart]` (whose absolute order is `vStart > 0`).

## Exact function + precise C-vs-TS difference

- **Function:** `keepoutLeft` (and symmetrically `keepoutRight`) in
  `src/layout/dot/position-cluster.ts` (≈ lines 142–169), the port of
  `keepout_othernodes` (`lib/dotgen/position.c:393`).
- **C:** `v = GD_rank(g)[r].v[0]` where `GD_rank(g)[r].v` is a **window pointer
  offset by the cluster's start** into the root rank array; `ND_order(v)` is the
  **absolute** order in the root rank (`>0` for non-leftmost clusters). The left
  scan `for (i = ND_order(v)-1; i>=0; i--)` over `GD_rank(dot_root(g))[r].v[i]`
  then constrains the nearest outside node to the cluster's left bbox node
  `GD_ln(g)` → 333 edges on 2471.
- **TS:** `const v0 = g.info.rank[r].v[0]` reads index 0 of the **full shared
  array** (not `rankGet(rk, 0) = rk.v[(rk.vStart ?? 0) + 0]`), so `v0` is the
  root rank's leftmost node and `nodeOrder(v0) === 0`. The left scan is empty →
  0 edges. (`keepoutRight` starts at `nodeOrder(v0) + rk.n = rk.n`; scanning
  upward it still emits 340 edges, but from the wrong base — likely wrong
  endpoints, masked by count parity here.)

## Proposed faithful fix (in `position-cluster.ts` — NOT in NS)

Make `keepoutLeft`/`keepoutRight` honour the rank window, mirroring C's
offset-pointer + absolute `ND_order`:

- Take the cluster's first node via the window: `rankGet(rk, 0)` (= `rk.v[(rk.vStart ?? 0)]`).
- Use the **absolute** order as the scan base. In C this is just `ND_order(v0)`;
  in TS, since the `order` field on the windowed node reads back as the
  window-local value here, use the absolute root-rank index
  `(rk.vStart ?? 0) + 0` for the left bound and `(rk.vStart ?? 0) + rk.n` for the
  right bound (equivalently, fix `order` to be stored absolutely for cluster
  nodes — see Layer 1/2 fixes, which made `medians/reorder` and
  `saveBest/restoreRank/restoreBest` honour `vStart`).

This restores the 333 left-keepout constraints, making the x-coord aux graph
conformant to C (20028 edges) — which (NS being faithful) is the necessary
and, by elimination, sufficient condition for C-equivalent convergence.

## Causation: by elimination (injection experiment was mechanically inconclusive)

The only difference in the NS *input* between C and TS is these 333 cluster
constraints (everything else conformant through `make_edge_pairs`, and the
other three `pos_clusters` sub-functions match exactly). The NS *algorithm* is
faithful. Therefore the missing constraints are the cause: they are precisely
the high-relevance containment constraints that pin cluster nodes relative to
outside nodes; without them the x-coord polytope has many equal-cost vertices →
the ~42% degenerate-pivot thrashing observed. A quick throwaway attempt to
inject the edges by an identity-search for `v0` in the root rank added 0 edges
(the windowed `v0` is not found by identity / order is window-local) — it
confirmed the `vStart` model divergence but did **not** prove convergence,
because injecting them correctly requires the same `vStart`-aware fix above
(out of write-set). A follow-up mission with `position-cluster.ts` in the
write-set should apply the fix and confirm 2471 converges (~24.5k pivots) and
renders end-to-end.

## Decision: STOP (write-set authorization required)

- Root cause is in `position-cluster.ts` (position phase cluster keepout),
  **outside the pre-authorised write-set `{ns.ts, ns-core.ts, +tests}`**.
- It is the **same `vStart`-window bug class** as mincross Layers 1 & 2, not an
  NS deviation. NS needs no change; Batch 3 (NS fix) does **not** apply.
- Stop conditions hit: *fix needs a file outside the write-set* +
  *implementation contradicts an architecture decision in the brief*.

## DEEPER ROOT CAUSE (post-authorization investigation, 2026-06-18)

After the user authorized applying the fix, deeper probing showed the cause is
**not** a `keepoutLeft` one-liner — `keepout`'s code is faithful. The cluster
rank window it reads is itself corrupt in the position phase, and the corruption
is created upstream in the **mincross cleanup**. Full chain (each step probed):

1. `keepoutLeft` reads `g.info.rank[r].v[0]` / `nodeOrder(v0)` — faithful to C.
2. But the cluster rank in position has **`vStart = 0`** and its `.v` is the
   **shared root array** (`sameArr=true`), so `.v[0]` is the *root's* node 0
   (often not even a member of the cluster). `order` IS absolute and correct
   (the cluster's real node sits at root index 230 with `order=230`); only the
   **window offset** is wrong.
3. `vStart` was correctly `ipos` right after `mergeRanksInstall` (cluster.ts:142;
   confirmed via a surviving tag on the same rank object). It is **reset** later
   by `applyVlistReset` (`reset_vlist`, mincross.ts:122) — TS port of C
   `rec_reset_vlists`, called from `cleanup2` (mincross.ts:304→230).
4. `applyVlistReset` sets `vStart = ND_order(furthestNode(g, rankleader, -1))`.
   Probe: for every cluster the **rankleader `g.info.rankleader[r]` has
   `order = 0`** (and is *not* a member of the cluster — `uIsNorm=false,
   uIsVn=false`). So `furthestNode(...,-1)` cannot move left and returns the
   rankleader at order 0; `furthestNode(...,+1)` correctly finds the cluster's
   right end (`wOrder=230`). The window is computed as `[0, 230]` (n=231,
   `vStart=0`) instead of the true `[205, 230]`.
5. `furthestNode`, `neighborNode`, `isNormalNodeOf`, `isVnodeOfEdgeOf` all match
   C line-by-line. The divergence is the **rankleader's order/identity** at
   `rec_reset_vlists` time: in C the rankleader is the cluster's representative
   sitting at its absolute window position; in TS it is at order 0.

### Revised fix location (NOT position-cluster.ts, NOT ns.ts)

The defect is in the **mincross cluster-cleanup rankleader handling** —
`applyVlistReset`/`recResetVlists` (mincross.ts) and/or how the cluster
`rankleader[r]` order is maintained through expand/merge/remincross
(cluster.ts `mergeRanksInstall`/`removeRankleaders`, mincross.ts `saveVlist`).
This is the SAME `vStart`-window family as mincross Layers 1 & 2 but its true
home is the mincross cleanup, not the position phase. Fixing it touches the
committed mincross machinery and **must** be validated against: the Layer 1/2
mincross fixes (2471 mincross still completes ~3.5s == C, order == C), the full
golden suite (zero x-coord churn), and the C x-order oracle — i.e. its own
mission with mincross regression coverage, not a position-phase patch.

**STILL STOPPED** (now for a different, deeper reason): the real fix is in
committed mincross code (`mincross.ts`/`cluster.ts`), outside even the
just-authorized `position-cluster.ts`, and carries regression risk to the Layer
1/2 work. Recommend a dedicated mission: *"2471 x-coord: fix cluster rankleader
order in rec_reset_vlists"*, write-set `{mincross.ts, cluster.ts, +tests}`, with
the convergence + x-order-parity + golden-churn gates from this brief.

## Harness recipe (all reverted)

- TS probes: `globalThis.__ns` (rank2Loop pivot trajectory: iter, sI, slack(f),
  neg-cut count), `globalThis.__aux` (per-stage edge count in `createAuxEdges`),
  `globalThis.__ko` (left/right keepout edge counters + v0 order/type/root-index
  diagnostics). Driven by `/tmp/ts_*_2471.mjs` over `dist/index.js`;
  `maxphase=3` injected after `{`.
- C oracle: instrument `lib/dotgen/position.c` `create_aux_edges` /
  `pos_clusters` / `keepout_othernodes` with `fprintf(stderr,...)`;
  `cd ~/git/graphviz/build && make gvplugin_dot_layout`; copy
  `plugin/dot_layout/libgvplugin_dot_layout*.dylib` → `/tmp/gvmine/`; run
  `GVBINDIR=/tmp/gvmine build/cmd/dot/dot -v -Tsvg tests/2471.dot`. **Revert C
  after** (`git -C ~/git/graphviz checkout -- lib/dotgen/position.c`).
- `dot -v` prints per-NS-call `"N nodes M edges K iter T sec"` — the
  balance=2 line is the x-coord NS (C: 8637/20028/24543 iter/2.2s).
