<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: cluster-expansion-recursion (defect C) — expand single-node leaf clusters

Self-contained brief. A fresh session should be able to execute this with **only
this file + the linked findings docs** — no prior conversation context needed.

## TL;DR

`1332.dot` crashes during `dot` layout. Root area is precisely located: three
single-node "label-wrapper" leaf clusters are **never expanded** by the port (so
they get no rank table), although **native C expands them**. Find why the port
skips them (a cluster registration / re-parenting *timing* issue) and fix it
faithfully so 1332 renders, with zero regressions.

## Startup (do this first)

1. `git checkout feature/cluster-membership-fix` — this branch already has the
   prerequisite fixes A+B (membership) and D2 (empty-cluster). Do **not** start
   from `main` (C only reproduces after A+B land).
2. Read `plans/cluster-membership-derisk/findings.md` and `root-cause.md` for the
   A/B/C/D defect map and native-C ground truth.
3. Read `plans/cluster-subsystem/README.md` — the umbrella mission. **C does not
   merge alone**; the whole cluster subsystem merges together once C + D (b53,
   2825) also pass the parity 0-regression gate.
4. Confirm the branch state with the repro below: 1767/1221/2721 render, 1332
   crashes.

## Repro (port)

```bash
cd ~/git/graphviz-ts
npx tsx -e 'import {renderSvg} from "./src/index.ts"; import {readFileSync} from "node:fs";
try{const s=renderSvg(readFileSync(process.env.HOME+"/git/graphviz/tests/1332.dot","utf8"),"dot");console.log("OK",s.length);}
catch(e){console.log((e as Error).message);}'
```
Current: `Cannot read properties of undefined (reading 'head')` —
`mapPathLongSingle` (`cluster-path.ts:154`). That crash is a **symptom**; the
cause is upstream (missing rank tables). **Do not guard the deref** (ADR-1).

Inner stack / state dump:
```bash
npx tsx -e 'import {parse} from "./src/parser/index.ts"; import {dotLayoutEntry} from "./src/layout/dot/index.ts"; import {readFileSync} from "node:fs";
const g=parse(readFileSync(process.env.HOME+"/git/graphviz/tests/1332.dot","utf8"));
try{dotLayoutEntry(g as any);}catch(e){let m=0,t=0;const names=[];
function walk(c){t++;if(!c.info.rank){m++;names.push(c.name);}const n=c.info.n_cluster??0;for(let i=0;i<n;i++)walk(c.info.clust[i]);}
walk(g as any);console.log("clusters",t,"missing info.rank",m,names);}'
```
Prints: `clusters 72 missing info.rank 3 [clusterc4046, clusterc6378, clusterc6755]`.

## The three offending clusters

```
clusterc4046  minrank=maxrank=12  1 node (c4046)  parent cluster_6754 (post-layout)
clusterc6378  minrank=maxrank=18  1 node (c6378)  parent cluster_6754
clusterc6755  minrank=maxrank=33  1 node (c6755)  parent root
```
All single-node, single-rank leaf clusters (`subgraph clustercNNNN { label="";
cNNNN [...] }` shape). 1332 has `compound=true`, `rankdir=LR`, deeply nested
clusters.

## Confirmed findings (don't re-derive)

- **Native C expands all three.** Instrumented `expand_cluster` (cluster.c) on
  1332: 66 clusters expanded, including `clusterc4046/c6378/c6755` (each
  `agnnodes=1, GD_n_cluster=0`). So C keeps and expands single-node leaf clusters.
- **Port expands none of the three** (68 expands total, different set). A
  cluster's `info.rank` is allocated only inside `expandCluster`
  (`cluster.ts:~204` `allocateRanks`); these three never reach it.
- **Re-reading `n_cluster` each loop iteration did NOT fix it.** C's
  `mincross_clust` re-reads `GD_n_cluster(g)` in the loop condition
  (`mincross.c:545`); the port captured it once. Making the port match (re-read)
  did not expand the three — so they are **absent from the parent's
  `clust`/`n_cluster` at mincross time**, i.e. a registration / re-parenting
  *timing* problem, not append-during-loop. (That change was reverted; re-apply
  only if the real fix needs it.)

## Root-cause hypothesis (to confirm)

The three clusters are registered into their parent's `clust` array (via
`makeNewCluster`, `rank.ts:207, called from collapseCluster`) either too late or
under the wrong parent, so `mincrossClust(parent)`'s recursion never reaches
them. Prime suspects:
- `collapseCluster` bail `if (subg.nodes.size === 0) return;` (`rank.ts:303`)
  interacting with first-cluster-wins (defect A `markClusters` agdelete): if a
  leaf cluster's only node is claimed by a sibling cluster first, the leaf may be
  treated as empty / mis-registered. (But native `agnnodes` is 1 — C keeps them,
  so the port must too.)
- Nested-cluster re-parenting order differing from C.

## Investigation plan

1. **Instrument the port's registration.** Log every `makeNewCluster(g, subg)`
   call (parent `g.name`, child `subg.name`, resulting `g.info.n_cluster`) and
   every `expandCluster` call. Find when (and under which parent)
   `clusterc4046/c6378/c6755` are registered, relative to when
   `mincrossClust(cluster_6754)` recurses.
2. **Instrument native C** for the same: `make_new_cluster` (cluster.c /
   rank.c) and `mincross_clust` recursion order. Diff registration order +
   parent assignment, port vs C. (C oracle recipe below.)
3. **Find the first divergence** — the point where the port fails to
   register/recurse a cluster that C does. Fix at the source faithfully.
4. **Verify** 1332 renders; the three clusters get `info.rank`.

## C oracle recipe (the spec)

Native dot 15.1.0 at `~/git/graphviz/build/cmd/dot/dot`, `GVBINDIR=/tmp/gvplugins`.
To instrument C:
```bash
# edit lib/dotgen/cluster.c or rank.c with fprintf(stderr, "DBG ...")
cd ~/git/graphviz/build && cmake --build . --target gvplugin_dot_layout
cp plugin/dot_layout/libgvplugin_dot_layout.* /tmp/gvplugins/
GVBINDIR=/tmp/gvplugins ~/git/graphviz/build/cmd/dot/dot -Tsvg ~/git/graphviz/tests/1332.dot >/dev/null 2>/tmp/c.txt
```
The complexity pre-commit hook flags pre-existing C-source complexity on edit —
that's expected for the graphviz repo; the edit still applies. **Always
`git -C ~/git/graphviz checkout lib/dotgen/*.c` and rebuild before finishing** so
the oracle stays clean.

## Files / symbols

| Concern | Port | C |
|---------|------|---|
| cluster registration | `rank.ts:makeNewCluster` (207), `collapseCluster` (299), `collapseSets` (310) | `rank.c:make_new_cluster`, `collapse_cluster`, `collapse_sets` |
| expansion recursion | `mincross.ts:mincrossClust` (271), `runClusters` (~327) | `mincross.c:mincross_clust` (~545), `dot_mincross` |
| rank-table alloc | `cluster.ts:expandCluster` (~200) → `allocateRanks` | `cluster.c:expand_cluster` → `allocate_ranks` |
| crash site (symptom) | `cluster-path.ts:mapPathLongSingle` (145) | `cluster.c:map_path` |

## Write-set (expected)
`src/layout/dot/rank.ts` and/or `src/layout/dot/mincross.ts` and/or
`src/layout/dot/cluster.ts`; a colocated test. If the fix needs another module,
STOP and re-scope.

## Quality gates
```
npm run typecheck   # exit 0 (TS6, --stableTypeOrdering)
npm test            # exit 0 (full suite ~2258)
npm run build       # exit 0
```
Plus: `1332.dot` renders; the 3 clusters get `info.rank`; 1767/1221/2721 still
render (don't regress the sibling fixes).

### Complexity hook gotcha
`~/.claude/hooks/check-complexity.py` blocks on per-function CCN > 10 and a
function-length cap. Two traps seen repeatedly this saga: (1) debug `console.error`
with `?.`/`??`/ternaries pushes CCN over; keep dumps to plain property access or a
separate helper. (2) **Section-divider comments (`// ---`) and inter-function
comments are attributed to the adjacent function's "length"** — keep them short
or remove them, and put long rationale inside the function body. Extract helpers
freely to stay under the cap.

## Architecture decisions (carry from the saga)
- **ADR-1** faithful C port, never a guard. C is the spec; instrument it.
- **ADR-4** "stops crashing + faithful to C" is success even if the case surveys
  `diverged` (1332 is a heavily-nested cluster graph; exact byte parity is not
  expected).
- **ADR-5** parity regen + 0 per-id regression is the gate — but run the parity
  survey only at the **end of the whole cluster-subsystem** (after C + D), not
  per-defect (the survey takes ~6 min; see `plans/cluster-subsystem`).

## Merge / commit
- Commit on `feature/cluster-membership-fix` (one commit for the C fix + test).
  Message: `fix(cluster): <...> (cluster-subsystem defect C)`. End body with
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Do not merge to main** until the unified `cluster-subsystem` parity gate is
  green (C + D done, 0 regressions). The membership fix is load-bearing: shipping
  partial cluster fixes regresses other graphs (this is why the work is unified).

## Stop conditions
- Fix needs a module outside the write-set not owned here → STOP, re-scope.
- 3 consecutive fixes to the same site for 1332 without progress → STOP, document.
- A fix makes a vitest test fail and the fix is the faithful one → rework the fix
  (it diverges from C), never edit the test.

## Decision journal
Append non-trivial calls here during execution.

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-22 | brief created; C ground truth captured (native expands all 3 leaf clusters; port none); re-read `n_cluster` ruled out | hand-off to a fresh session to avoid context bloat |
| 2026-06-22 | **brief hypothesis disproven; true root cause found.** The 3 leaf clusters miss `info.rank` only as a *consequence*: the mincross expansion loop crashes at an earlier sibling (clusterc5359, index 21) before reaching them (indices 22/23). Crash is `interclexp(clusterc5359)→mapPath` walking a broken virtual chain for edge `c0->c5359`. | instrumented port (collapse/expand/recursion/deleteFastEdge) + native C (map_path/interclexp/remove_rankleaders) |
| 2026-06-22 | Root cause: `markClusterNode` deletes a foreign (first-cluster-wins) node from `clust.nodes` but NOT its incident edges from `clust.edges`. C's `agdelete`/`agdelnode` removes both. `clusterc0` is a root **sibling** of `cluster_6754` (source lines 9–10), but `node_induce` induces `c0->c5359` into `cluster_6754.edges`. After A's agdelete drops `c0` from the node set, the edge lingers → `agContainsEdge(cluster_6754, c0->c5359)`=true → `interclexp(cluster_6754)` skips it → chain through cluster_6754's rank-15 rankleader is never restored → `removeRankleaders` orphans it. | C `agcontains(cluster_6754, c0->c5359)`=0 (processes) vs port=true (skips); matches defect-A findings note "mirror agdelete's edge cleanup as C does" (omitted in impl) |
| 2026-06-22 | Fix: `agDeleteFromCluster` mirrors `agdelnode` — drop the node AND its incident edges from the cluster's edge set. One commit + colocated unit test (fails without the fix). | minimal, in-scope (cluster.ts), faithful to C; 1332 renders, all 72 clusters get `info.rank`, 1767/1221/2721 unregressed, suite 2259 green |

## Status
| Phase | Status |
|-------|--------|
| Instrument C expansion recursion vs port | [x] C expands all 3; port expands none |
| Root-cause port registration/re-parenting timing | [x] disproven — real cause is `markClusterNode` not removing incident edges of agdeleted foreign nodes (`agContainsEdge` then skips a crossing edge in `interclexp`, orphaning its chain) |
| Fix | [x] `agDeleteFromCluster` mirrors C `agdelnode` edge cleanup (cluster.ts) |
| Verify (1332 renders) + suite green | [x] 1332 renders, 72/72 clusters get `info.rank`, 1767/1221/2721 render, typecheck 0, suite 2259, build 0 |
