# F7 — AGSEQ node-iteration order at agfstnode-mirroring sites

Authored from F3's stop-report (mechanism pinned, byte-exact experiment).
Runs ALONE; own commit; immediate full survey (D2).

## Context
C's `agfstnode(g)`/`agnxtnode(g,n)` iterate a subgraph's nodes by AGSEQ —
the global, root-graph-wide creation-sequence counter (comparator
`lib/cgraph/node.c:283-290`) — regardless of when the node was added to
THIS subgraph. The port's `g.nodes` Map iterates by subgraph-local
first-insertion. For nodes created in one subgraph and later added to
another (b51.gv: blok_10 created in cluster_if_28:25, added to
cluster_if_40:34) the orders diverge. `class1` (classify.ts:143) and
`decompose` (decomp.ts:130) both consume the wrong order; patching both to
global-id order renders graphs-b51 BYTE-EXACT (F3's controlled experiment).
NS itself is faithful.

## Task
1. Verify the port's Node `.id` truly mirrors AGSEQ for ALL creation paths
   (parser, builder API, virtual/cluster-leader nodes) — read C's
   agnextseq usage vs the port's id minting. If `.id` ≠ AGSEQ anywhere,
   use/introduce the correct seq field.
2. Add ONE shared helper (e.g. `nodesInSeq(g)` in the dot layout utils or
   fastgr.ts) documenting `@see cgraph/node.c:agfstnode/agnxtnode`.
3. Apply at class1 + decompose (confirmed), then AUDIT every other
   `g.nodes` iteration in src/layout/dot/ that mirrors a C agfstnode loop
   (cluster.ts markClusters/nodeInduce/clusterLeader, rank.ts, position.ts,
   mincross init, etc.) — fix ONLY sites whose C counterpart uses
   agfstnode/agnxtnode; leave port-internal loops alone. List every site
   audited with its C counterpart and fixed-or-not in the note.
4. Regression test: fixture where a node joins a second subgraph late;
   assert iteration order matches AGSEQ.
5. Verify watch ids before/after (render + flat-geom-diff): graphs-b51
   (expect Δ0), share-b51 (must stay conformant), 2475_2, 2521, 1447,
   2239, 2371 spot-check. npm run test; tsc.
6. Commit alone; IMMEDIATELY full survey + gate; zero GENUINE regressions
   (flaky timeout signature: maxΔ 0.0 + big graph → re-verify standalone
   before treating as real, per F4 precedent). Genuine regression → revert.

## Write-set
- `src/layout/dot/classify.ts`, `src/layout/dot/decomp.ts`, audited
  siblings in src/layout/dot/ (cluster.ts, rank.ts, position.ts,
  mincross*.ts) — iteration-order changes ONLY, plus the helper + tests
- `.agent-notes/path-structure-xns-residuals.md` (append F7 outcome)

## Stop conditions
- `.id` does not mirror AGSEQ and adding a proper seq field would ripple
  beyond node creation sites → stop, report.
- Any site's C counterpart order is ambiguous → leave it, note it.
- Genuine survey regression that revert doesn't explain → stop.

## Rollback: Reversible — single commit.
