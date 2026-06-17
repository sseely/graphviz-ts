# T1 — Deep C control-flow trace (faithful-first)

## Context

The hang is node `c` installed twice into root rank 1 — once by root
`buildRanks`, once by `cluster0`'s `expandCluster` `buildRanks`. `c` is in
cluster1 but the `{rank=same; b; c}` union (b ∈ cluster0) drags it into
cluster0's component. Per AD-1, we do NOT patch with a mark-guard; we first
establish exactly what C does, then port it faithfully (Batch 2).

## Task — produce `docs/newrank-c-trace.md`

Trace the C path for the repro `digraph{newrank=true; subgraph cluster0{a->b->e}
subgraph cluster1{c->d} a->c; {rank=same; b; c}}` through `~/git/graphviz/lib/
dotgen`, answering with line citations:

1. **Rank-set collapse:** How does `collapse_rankset` / `class1` / `dot2_rank`
   handle a `rank=same` set whose members live in DIFFERENT clusters (b in
   cluster0, c in cluster1)? Which node becomes the union leader, and what
   `ND_ranktype`/`ND_clust` does `c` end up with? (`rank.c`, `class1.c`,
   `cluster.c`.)
2. **Component decomposition:** In `decompose` / `class2`, which component does
   `c` land in? Is `c` a member of cluster0's induced subgraph, cluster1's, or
   only the root's?
3. **Cluster collapse for build:** In `build_ranks` + `install_cluster` +
   `cluster_leader`, how does C ensure a cluster's members are installed exactly
   once? Specifically: is `c` installed by the ROOT `build_ranks`, by a cluster's
   `build_ranks`, or routed through a CLUSTER pseudo-node? What stops the double
   install that the TS port suffers?
4. **The TS divergence:** Map each C step to its TS port
   (`rank-dot2.ts`, `classify.ts`, `decomp.ts`, `cluster.ts`,
   `mincross-build.ts`, `mincross-order.ts`) and identify the SPECIFIC place
   where TS installs `c` twice where C installs it once. State the minimal
   faithful change and its file.

## Method

- Read the C: `rank.c` (dot2_rank, collapse_rankset, cluster_leader),
  `class1.c`/`class2.c`, `decomp.c`, `cluster.c` (install_cluster,
  expand_cluster), `mincross.c` (build_ranks, install_in_rank).
- You MAY build/inspect oracle intermediate state via the dot binary with
  `-Tplain` / verbose, and you MAY add TEMPORARY instrumentation to the TS port
  to confirm the divergence (revert it — do not commit instrumentation).
- Cross-reference every C claim to a `file:line`.

## Write-set

- `docs/newrank-c-trace.md` — the trace + the named minimal faithful fix

## Read-set

- `decisions.md#ad-1`, `#ad-3`
- `~/git/graphviz/lib/dotgen/{rank,class1,class2,decomp,cluster,mincross}.c`
- TS: `rank-dot2.ts`, `classify.ts`, `decomp.ts`, `cluster.ts`,
  `mincross-build.ts`, `mincross-order.ts`, `mincross-utils.ts`

## Acceptance criteria

- **Given** the doc, **then** it answers all four questions with C `file:line`
  citations and names the SINGLE minimal faithful change (file + function +
  what C does that TS doesn't).
- **Given** AD-3's allowed write-set, **then** the named fix location is inside
  it — OR the doc explicitly flags it as outside (→ STOP/rescope trigger).
- **Given** the repo, **then** no source/test/golden changed (doc-only;
  instrumentation reverted).

## Quality bar

Doc-only; no gates beyond "working tree clean except the new doc." If the trace
shows the fix is outside the allowed write-set, STOP per AD-3.
Commit: `docs(T1): trace C newrank cross-cluster rank=same routing`.

## Observability / Rollback

N/A. Reversible (doc-only).
