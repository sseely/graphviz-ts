# Mission: dot pack branch for CLUSTERED multi-component graphs (T3 follow-up)

## Objective

Complete the dot `doDot` pack branch for **clustered** multi-component graphs —
the deferred T3 of [`fix-pack-dot-2458`](../fix-pack-dot-2458/README.md). That
mission landed the cluster-FREE pack path (2458 + 2682 → byte-match, 0
regressions, merged). Clustered multi-component graphs currently fall back to
whole-graph layout via a `graphHasCluster` guard in `doDot`
(`src/layout/dot/index.ts`). This mission removes that guard and makes a clustered
graph decompose → lay out each component (with its clusters) → pack → copy cluster
info back, matching headless dot 15.1.0.

Targets: **2592** (`diverged` maxΔ=564) and **2683** (clustered, currently
falls back) → structural-match, **zero survey regressions**, 2458/2682 stay
byte-match.

## Why this is a separate mission (not finishable in fix-pack-dot-2458)

T3's cluster-carry is the easy half; it was implemented and proven tsc-clean (see
[approach.md](approach.md) — the full `cccompsWithClusters` + `projectG` +
`copyCluster`/`copyClusterInfo`/`mapClust`). The hard half is that laying out a
clustered **component** crashes in the **cluster mincross core**, which assumes it
runs on the true root. Fixing it is a multi-site rework of the most
regression-prone subsystem (memory: cluster defects A/C/D, RC1–RC4) — out of the
original T3 write-set. Hence a dedicated derisk mission.

## Cascade map (known component-vs-root fix sites)

A packed component is laid out as its own dot-root (`info.dotroot = self`), but
`g.root` stays the true cgraph root. The cluster mincross code branches on the
wrong one. Confirmed so far (port → C-faithful target):

1. **`rank.ts:expandRanksets`** — gates cluster `set_minmax` on `g === g.root`;
   C uses `g == dot_root(g)`. Fix: `g === (g.info.dotroot ?? g.root)`. 1-line,
   behavior-preserving for whole-graph. Without it: cluster `minrank/maxrank`
   unset → undersized `rankleader` → null in `buildSkeleton`
   (`cluster.ts:322`). @see lib/dotgen/rank.c:expand_ranksets
2. **`cluster.ts:mergeRanks` → `cluster-path.ts:makeSlots`** — indexes the
   component's root rank array (`root.info.rank[r]`) at a rank the component
   doesn't span → `undefined`. Needs the component-as-dot-root rank array set up
   the way the true root's is. @see lib/dotgen/cluster.c:merge_ranks / make_slots
3. **Likely more** — `install_cluster`, `mincrossClust` root refs, position-phase
   cluster bb. Enumerate by running 2592 and following each crash, fixing the
   `g.root` vs `dot_root(g)` (and root-rank-array) assumption at each site.

Audit pattern: `grep -n 'g\.root\|=== g.root\|g === g.root' src/layout/dot/cluster*.ts
src/layout/dot/mincross*.ts` and compare each to C's `dot_root(g)` /
`agroot(g)` usage.

## Write-set (expanded vs T3 — that's the point)

- `src/layout/dot/pack-components.ts` — cluster-carry (see approach.md), remove
  the stub `copyClusterInfo`.
- `src/layout/dot/index.ts` — remove the `graphHasCluster` guard; call
  `cccompsWithClusters`.
- `src/layout/dot/rank.ts`, `src/layout/dot/cluster.ts`,
  `src/layout/dot/cluster-path.ts`, `src/layout/dot/mincross.ts` — the
  component-vs-root fixes (cascade map), each C-faithful (`dot_root`).
- Goldens: `test/golden/{inputs,refs}/pack-clusters-2592.*` (already committed),
  plus a nested-cluster fixture.
- `src/layout/dot/pack-components.test.ts` — extend.

## Quality gates (same as fix-pack-dot-2458)

| command | pass |
|---|---|
| `npx tsc --noEmit --stableTypeOrdering` | exit 0 |
| `npx vitest run` | exit 0, new cluster tests green, 2458 stays byte |
| `GVBINDIR=/tmp/ghl PARITY_OUT=parity-rules.json npx tsx test/corpus/survey.ts` | 2592 → match |
| `npx tsx test/corpus/rules-gate.ts` | regressions = 0 |

Oracle: headless 15.1.0 (`GVBINDIR=/tmp/ghl`), Estimate measurer. Refresh
`parity.json`←`parity-rules.json` + `dashboard.ts` on completion (memory
`parity-json-recipe-estimate-ghl`).

## Risk / stop conditions

- The cluster mincross is regression-prone. After EACH cascade fix, re-run the
  full vitest + rules-gate; STOP on any regression a fresh 15.1.0 oracle confirms.
- If a fix at one site contradicts C (no `dot_root` analogue), stop and
  re-investigate rather than forcing it.

## Index

- [approach.md](approach.md) — the cluster-carry code (decomposition + projectG +
  copyClusterInfo), proven tsc-clean in fix-pack-dot-2458.
- Source of cascade detail: `../fix-pack-dot-2458/decision-journal.md` (T3 rows).
