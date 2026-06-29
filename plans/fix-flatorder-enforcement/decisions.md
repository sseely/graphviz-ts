# Architecture decisions

## AD-1: Instrument C install order before any fix (Batch 0 spike)

- **Context**: the prior mission proved a naive weight-0 change is insufficient
  (it broke b58 node 7). The exact enforcement divergence — port `build_ranks`
  install order vs C's, and the role of FLATORDER weight in each — is not yet
  pinned at the value level.
- **Decision**: Batch 0 dumps C's per-rank install order through `build_ranks` /
  `enqueue_neighbors` on b58 (how 6 ends up before 8), the FLATORDER edge weights C
  actually carries, and the port's equivalents. Pin the FIRST point where the port's
  enforcement diverges from C's.
- **Consequences**: Batch 1 consumes a pinned divergence; no guessing. Temporary
  env-gated C/port instrumentation, reverted after capture.

## AD-2: Root-cause-driven write-set (decided by Batch 0)

- **Context**: the enforcement fix is likely in `build_ranks`/`enqueue_neighbors`
  install order (`mincross-build.ts`), and/or the `newVirtualEdge(orig=null)`
  defaults (`fastgr.ts` — C leaves weight/count/xpenalty/minlen at calloc-0, the
  port sets them to 1), and/or `flat_reorder`/`flat_search` weight handling
  (`mincross-flat.ts`).
- **Decision**: do NOT pre-commit the write-set. Batch 0 determines which file(s)
  hold the divergence; Batch 1's write-set is exactly those (+ tests). If install
  order and the weight defaults both need changing they are one logical unit.
- **Consequences**: minimal blast radius; bisectable to one cause.

## AD-3: Hard invariant — no byte-match regression

- **Context**: mincross/flat is tie-break-fragile (see memory notes
  `mincross-perf-is-perop-not-iteration`, `flat-edge-241-is-y-only`,
  `1624-flat-corridor-makefwdedge`, `ordering-agseq-inherit-done`). 493 graphs
  byte-match overall; the prior mission's b58 node-7 fix and `graphs-in` are
  explicit canaries here.
- **Decision**: full survey after EVERY change; any byte-match→worse is STOP +
  revert. The weight-0 experiment that broke node 7 is the cautionary precedent —
  enforcement changes ripple into ALL flat-edge graphs, not just ordering ones.
- **Consequences**: ~17 min/iteration accepted.

## AD-4: Faithful to C's model, not a port-local heuristic

- **Context**: the port could be patched to special-case FLATORDER in its existing
  weight-1 `flat_reorder`. That would diverge structurally from C.
- **Decision**: reproduce C's actual model — weight-0 FLATORDER edges enforced via
  `build_ranks` install order — rather than inventing a port-only enforcement path.
  If the port's `build_ranks` cannot honor install order the way C does, fix
  `build_ranks` to match C (that IS the C spec), not paper over it in flat_reorder.
- **Consequences**: aligns with the project's "C is sacred" directive; may touch
  build_ranks more than expected (validated by AD-3's gate).

## AD-5: Outcome bar — clear what's faithfully fixable, document the rest

- **Decision**: a graph is "done" when its in-rank node order matches C. If a
  further secondary cause (x-NS, spline) keeps it diverged after enforcement is
  correct, document the residual and move on — do not chase unrelated causes.
- **Consequences**: honest close on the enforcement root cause.

## stop-conditions

1. Any byte-match→worse regression in the survey. STOP + revert that change.
2. 2 consecutive gate failures on the same check. STOP.
3. A fix needs to write outside its declared write-set. STOP.
4. 3 consecutive edits to the same site without resolving it. STOP.
5. A fix cannot make b58's 3/6/8 in-rank order match C without regressing other
   graphs (esp. the node-7 fix or `graphs-in`). STOP + document.

## Key C references (read-only spec)

- `lib/dotgen/mincross.c`: `build_ranks` (1212), `enqueue_neighbors` (after 1290),
  `install_in_rank` (1164), `flat_reorder` + `constraining_flat_edge` + `postorder`,
  `flat_search` (1073; `ED_weight==0 continue` at 1093), `do_ordering_node` (432).
- `lib/dotgen/fastgr.c`: `new_virtual_edge` — `if (orig){...}` block copies AGSEQ +
  fields; with `orig==NULL` ED_weight/count/xpenalty/minlen stay calloc-0.
- `lib/common/const.h`: FLATORDER edge-type constant (4).
- Port mirror: `src/layout/dot/mincross-build.ts` (`buildRanks`,
  `enqueueNeighbors`/`installInRank`, `doOrderingAddFlatEdges`),
  `src/layout/dot/mincross-flat.ts` (`flatReorder`, `constrainingFlatEdge`,
  `flatSearch`), `src/layout/dot/fastgr.ts` (`newVirtualEdge` orig=null defaults).

## Ground-truth data (b58, prior mission)

- C node x: `{1:27, 6:45, 3:81, 2:99, 8:117, 5:171, 7:207, 4:243}` (middle rank order 6,8,7).
- Port node x after construction fix: `{1:27, 2:99, 4:243, 5:171, 7:207, 6:99, 8:27, 3:63}`
  (nodes 1,2,4,5,7 EXACT; middle rank order 8,6,7 — WRONG; node 3 x off).
- FLATORDER `6->8` is built (PORTDBG-confirmed); enforcement is the gap.
- Weight=0 experiment result: b58 8→12 diverged (broke node 7) — do NOT repeat naively.
