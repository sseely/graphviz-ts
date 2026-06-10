# dot-nested-cluster hang investigation (2026-06)

## Observation: subgraph membership must propagate to all ancestors
- **Context**: renderSvg(dot-nested-cluster) hung forever in furthestNode
  (mincross cleanup2 → recResetVlists).
- **Finding**: cgraph semantics — `agnode`/`agedge` in a subgraph add the
  node/edge to EVERY enclosing graph up to root. The parser builder only
  added to the immediate subgraph + root, so nodes declared in a nested
  cluster were invisible to the enclosing cluster's `nodes` map. At root
  mincross, `markClusters` then failed to set `info.clust` on those nodes,
  `class2` fast-noded them into the root nlist, and `buildRanks` installed
  them into root rank rows ALONGSIDE the cluster skeleton leader. When
  `mergeRanks` later spliced the real node in at the leader slot, the rank
  row held the node twice (`[B, B]`), making `neighborNode` return the same
  node forever (`rk.v[B.order + 1] === B`).
- **Impact**: any code that iterates `subgraph.nodes`/`subgraph.edges`
  (markClusters, buildSkeleton, interclexp, isVnodeOfEdgeOf,
  clusterLeader) silently misbehaves for nested clusters if membership is
  not propagated. Fixed in src/parser/builder.ts.
- **Confidence**: High

## Observation: V8 --prof finds synchronous hangs in seconds
- **Context**: prior sessions bisected the hang by adding throw-guards to
  individual loops (4+ rounds, no hit).
- **Finding**: `esbuild --bundle` the repro to plain JS, run
  `node --prof`, kill after ~10 s, then `node --prof-process` — the hot
  function (here 99.7 % in one frame) plus its caller chain appear
  immediately. Works even though the process is killed, because the
  isolate log streams continuously.
- **Impact**: use this first for any future hang; do not bisect with
  guards.
- **Confidence**: High

## Observation: pre-class1 fastEdge on raw edges self-merges
- **Context**: rank.test.ts / dot.test.ts hung after the debug guards were
  removed.
- **Finding**: test helpers called `fastEdge(e)` on raw edges before
  `dot1Rank` (written when class1 was a stub). class1's `findFastEdge`
  then returned the raw edge itself → `mergeOneway(e, e)` set
  `e.to_virt = e` → `basicMerge`'s `for (f = rep; f; f = f.info.to_virt)`
  looped forever. In C this state is unreachable: the fast graph contains
  only virtual edges at class1 time. Never pre-install raw edges into the
  fast graph in tests.
- **Confidence**: High

## Observation: .claude/worktrees gitlinks are tracked
- **Context**: pre-flight for the test-parity project brief.
- **Finding**: `git ls-files .claude` shows agent worktree gitlinks
  committed at some point. Now ignored going forward, but the tracked
  entries need `git rm --cached` in a dedicated cleanup commit.
- **Impact**: clutter; harmless to builds.
- **Confidence**: High

## Observation: cd into a subdirectory spawns project scaffolding
- **Context**: M1/T3 — a shell command ran with cwd
  plans/test-parity; minutes later that directory contained
  .mcp.json, .serena/project.yml, .agent-notes/.gitkeep, and a
  .gitignore, which `git add plans/test-parity` then swept into the
  commit.
- **Finding**: a directory-init hook treats any cwd as a potential
  project root and writes serena/MCP scaffolding there.
- **Impact**: never `git add <dir>` after cd'ing into it mid-session;
  add explicit file paths or inspect `git status` first. Artifacts are
  safe to delete.
- **Confidence**: Medium (hook not identified, effect reproduced once)
