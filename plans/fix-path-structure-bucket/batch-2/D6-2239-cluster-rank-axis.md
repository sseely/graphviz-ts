# D6 — Diagnose 2239: nested-cluster rank-axis compression under rankdir=LR

## Context (read .agent-notes/path-structure-rank-extent.md Block 3 first)
`2239.dot` (gstreamer graph, rankdir=LR, 80 subgraphs with NESTED clusters —
`cluster_X_sink`/`_src` inside `cluster_X`) diverges maxΔ 5287. T1
established: cross-rank axis (height) matches EXACTLY (1045pt); rank-bucket
count identical (33); zero rank=same declarations; no membership-eviction
warnings. Only the RANK axis (width under LR) is compressed: C 12078pt vs
port 6799pt (44% smaller). So ranks and order are right; per-rank extent /
inter-rank separation is wrong. Prior mission note
`.agent-notes/cluster-margin-rl-containment.md` fixed 3 cluster-margin bugs
and explicitly recorded 2239 UNCHANGED — a distinct, unresolved nested-
cluster mechanism.

## Task
Diagnosis ONLY (~/.claude/rules/diagnosis.md). Pin why the port's rank-axis
extent is ~44% of C's:
1. Localize: compare per-rank x-extents (node raw coords, C vs port SVG) —
   is the compression uniform across ranks, or concentrated in ranks
   containing nested clusters? Are inter-rank GAPS smaller, or are cluster
   boxes themselves narrower?
2. Suspects to check against C (`~/git/graphviz/lib/dotgen/`): ranksep
   handling under rankdir=LR for clusters (`position.c` set_ypos/dot_splines
   rank separation with cluster margins), cluster expansion
   (`~/git/graphviz/lib/dotgen/cluster.c` expand_cluster /
   `src/layout/dot/cluster*.ts`), and the virtual-chain spacing for
   cluster-crossing edges. Note rankdir=LR means the layout runs in a
   rotated frame — check where the port applies the rotation and whether a
   cluster-extent computation reads the wrong axis (prior art: recordInside
   rankdir rotation bug in [[1332-edge-routing-three-defects-done]]).
3. Instrument (env-gated, e.g. CLDBG) the per-rank coordinate assignment for
   a small slice of the graph; if the input is too big, hand-craft a minimal
   nested-cluster rankdir=LR repro and verify it reproduces the compression.
   A minimal repro that shows the mechanism is a first-class deliverable.

## Write-set
- `.agent-notes/2239-cluster-rank-axis.md` (deliverable, standard schema)
- Temporary env-gated instrumentation in `src/layout/dot/cluster*.ts`,
  `position-cluster*.ts` (cluster containment/expansion code) — fully
  reverted before finishing. Do NOT instrument ns.ts/position.ts core
  (owned by a later NS task), src/render/, src/ortho/, or
  edge-route-chain.ts (owned by parallel tasks).

## Read-set
- `.agent-notes/path-structure-rank-extent.md` Block 3
- `.agent-notes/cluster-margin-rl-containment.md`
- C: `~/git/graphviz/lib/dotgen/cluster.c`, `position.c` (set_ypos,
  rank separation), `rank.c` cluster collapse/expand
- Port: `src/layout/dot/cluster*.ts`, `position-cluster*.ts` (locate via
  Serena)

## Repro
```
GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg ~/git/graphviz/tests/2239.dot -o /tmp/2239.c.svg
GV_TEXT_MEASURER=estimate npx tsx test/corpus/render-one.ts ~/git/graphviz/tests/2239.dot dot > /tmp/2239.port.svg
node test/diagnostic/flat-geom-diff.mjs /tmp/2239.c.svg /tmp/2239.port.svg
```
Bash allowlist: first token one of node, npx, npm, git, python3, ls, cat,
grep, find, head, tail, wc, sort, diff, mkdir, cp, mv. NEVER `cd`-prefix;
scripts to files (`node /tmp/d6-x.mjs`), never `node -e`.

## Interface contract
Note per the batch-1 overview schema (Mechanism/Origin/Causal chain/Ruled
out/Fix target JSON with classification).

## Quality bar
- `git status` clean except your note (parallel tasks' files may be dirty —
  leave them); your instrumented files diff-clean.
- Mechanism + file:line pinned, or ruled-out list + exact next step. No
  fixes.
