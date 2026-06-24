<!-- SPDX-License-Identifier: EPL-2.0 -->

# Mission: cluster SVG `@id` AGSEQ numbering

## Objective

Port cgraph's subgraph sequence (`AGSEQ`) numbering so cluster SVG ids match
the native `dot` oracle. `getObjId` (emit.c:230) emits `clust<AGSEQ(subgraph)>`,
where `AGSEQ` is a **global subgraph-creation counter on the root graph**
(`agnextseq` → `++clos->seq[AGRAPH]`, graph.c:152) incremented in source order
and counting anonymous subgraphs. The port instead emits a dense
`job.clusterId++` (1, 2, 3 …). When anonymous subgraphs are interleaved between
clusters, the two numberings diverge — e.g. `nestedclust`: port `clust1,2,3`
vs oracle `clust2,6,7`. Geometry already matches (maxDelta 0); only the id
string is wrong, forcing a `diverged` verdict.

## Confirmed impact (verified by render diff, all maxDelta 0)

Flips `diverged` → byte/structural-match: **`graphs-nestedclust`,
`linux.x86-nestedclust_dot`, `macosx-nestedclust_dot`, `nshare-nestedclust_dot`,
`705`, `graphs-b7`, `1514`** (7 cases). Also the first-diff for ~8 multi-axis
cases (`121`, `258`, `2242`, `2592`, `1436`, `1453`, `1332`, `graphs-world`) —
those re-bucket to their next diff (progress, not a flip).

This is distinct from the `anon-subgraph-naming` plan (which targets `%N`
`<title>` text via a *different* counter and wrongly assumed cluster ids
"already match").

## Branch

`feature/cluster-id-agseq` — merge to `main` with a **merge commit** (mission
brief: per-task commit ids referenced in the decision journal).

## Constraints

### Stop conditions
- A `clust*` / `labelclust*` byte-match case regresses for a reason **other
  than** edge-endpoint-subgraph seq drift → stop, document.
- Two consecutive survey runs show net regressions.
- The fix would require changing node or edge id assignment — out of scope;
  those already match the oracle.

### Push-forward (decide autonomously)
- Port edge-endpoint subgraph seq-numbering (T4) **iff** T3's survey shows a
  target failed to flip due to that drift.
- Remove the dead `job.clusterId` field.

## Quality gates

Run between batches. See `~/.claude/rules/autonomous-execution.md`.

```
- command: npx tsc --noEmit --stableTypeOrdering
  pass: exit 0 (zero output)
  on_fail: fix_and_rerun
- command: npx vitest run
  pass: exit 0, all tests green
  on_fail: fix_and_rerun
- command: npx tsx test/corpus/survey.ts && npx tsx test/corpus/dashboard.ts
  pass: 7 targets flip out of diverged; 0 net regressions (clust*/labelclust*
        byte-matches preserved)
  on_fail: fix_and_rerun
- command: git diff --name-only HEAD~1
  pass: matches the task's declared write-set only
  on_fail: stop
```

## Batches

| # | Task | Status | Doc |
|---|------|--------|-----|
| 1 | T1 — seq model (Graph.seq + root counter + agsubg wiring) | [x] | [batch-1/T1-seq-model.md](batch-1/T1-seq-model.md) |
| 2 | T2 — emit `clust<seq>`; retire `job.clusterId` | [x] | [batch-2/T2-emit-clust-seq.md](batch-2/T2-emit-clust-seq.md) |
| 3 | T3 — survey verify + regen PARITY.md | [x] | [batch-3/T3-survey-verify.md](batch-3/T3-survey-verify.md) |
| 3 | T4 — endpoint-subgraph seq (CONTINGENT, not triggered) | [N/A] | [batch-3/T4-endpoint-subgraph-seq.md](batch-3/T4-endpoint-subgraph-seq.md) |

## Index

- [decisions.md](decisions.md) — architecture decisions
- [batch-1/overview.md](batch-1/overview.md)
- [batch-2/overview.md](batch-2/overview.md)
- [batch-3/overview.md](batch-3/overview.md)
- [diagrams/component-map.md](diagrams/component-map.md)
- [diagrams/data-flow.md](diagrams/data-flow.md)
- [decision-journal.md](decision-journal.md)

## Mission summary (2026-06-22 — COMPLETE)

- **Tasks:** T1, T2, T3 completed; T4 not triggered (contingency unmet).
- **Outcome:** Cluster SVG ids now emit `clust<AGSEQ seq>` from a root-level
  subgraph counter (`Graph.seq`/`subgSeqCounter` + `assignSubgSeq`), wired into
  both creation paths (parser `processSubgraph` + `agsubg`). Dense
  `job.clusterId` retired.
- **Survey:** 7/7 confirmed targets flipped out of `diverged`
  (graphs-nestedclust, linux.x86/macosx/nshare-nestedclust_dot, 705, graphs-b7
  → byte-match; 1514 → structural-match). **0 regressions.** Counts:
  byte-match 272→278, structural 232→236, diverged 264→254. Re-bucketed
  (progress): 121/258/2242 diverged→structural-match.
- **Quality gates:** `tsc --noEmit` exit 0; vitest 2304/2304 green
  (2301 baseline + 3 new T2 render tests + 4 new T1 seq tests, minus overlap).
- **Decisions:** reopened named subgraph reuses prior seq (merge semantics
  untouched, out of scope); T4 deferred — no corpus case exercises the
  endpoint-subgraph branch ahead of a cluster. See decision-journal.md.
- **Merge:** `12af58c` merge commit on `main` (per-task ids preserved).
- **Known follow-ups:** none required. The endpoint-subgraph seq branch (T4)
  remains unported but is provably unexercised by the current corpus; port it
  if a future case surfaces the drift.
