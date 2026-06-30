# Mission: Port the dot multi-component `pack` branch (corpus 2458)

## Objective

Corpus **2458** (`digraph { pack=1; q16; q1 -> q2[label=connected] }`) is
`diverged` (maxΔ=74.8) — the **smallest** diverged case. The port's
`dotLayoutEntry` calls `dotLayoutPipeline(g)` directly and is missing C's `doDot`
wrapper (`dotinit.c:doDot` ≈437-500): when `pack`/`packmode` is set, C decomposes
the graph into connected components (`cccomps`), lays out **each separately**, then
`packSubgraphs` polyomino-packs them. The port instead ranks both components in one
structure, so `pack` is effectively ignored for dot (native 132×116 compact
side-by-side; port 164×133 top-aligned). Port the `doDot` pack branch faithfully —
including `copyClusterInfo` — flipping 2458 `diverged → structural-match` with
**zero survey regressions**.

Most primitives already exist (`ccomps`, `getPack*`, `getPackInfo`,
`packSubgraphs` — all in `src/layout/pack/`, used by twopi; the port's pack ops run
in **points on `n.info.coord`**, so C's inches/`ND_pos` `attachPos`/`resetCoord`
are **not** needed). The work is the `doDot` wrapper + component drawing-info seed
(`initSubg`) + cluster carry + `copyClusterInfo`.

## Branch

`fix/pack-dot-2458` off clean `main`. Merge-commit on completion (per-task commit
IDs are referenced in the decision journal).

## Source of truth

- C spec: `~/git/graphviz/lib/dotgen/dotinit.c` — `doDot` (≈437-500), `initSubg`
  (≈344), `attachPos`/`resetCoord` (≈362/377, port does NOT need these),
  `copyCluster`/`copyClusterInfo` (≈388/412). Pack attrs: `lib/pack/pack.c`.
- Decisions: [decisions.md](decisions.md) (ADR-1..5).

## Constraints

**Stop conditions** (halt + log to decision-journal, wait for human):
- Fix locus falls **outside** `src/layout/dot/index.ts` + new
  `src/layout/dot/pack-components.ts` (+ tests/goldens) — write-set assumption broken.
- A change to `src/layout/pack/**` internals or `src/layout/twopi/**` appears
  necessary (ADR-3: the shared pack module works for twopi — don't touch it).
- `rules-gate.ts` shows **any** regression a fresh isolated 15.1.0 oracle confirms
  is real (not cache skew).
- Same approach changed 3× consecutively without converging.
- 2 consecutive quality-gate failures on the same check.

**Push-forward** (decide and log):
- Exact pack offsets / sub-pixel shape, as long as 2458 structurally matches and
  the survey is green.
- Whether `initSubg` / cluster-carry are actually needed (T1 decides with evidence).
- Synthetic cluster oracle if no clustered multi-component corpus case exists.
- Byte-match if it falls out naturally (not required — ADR-5).

## Quality gates

| command | pass | on_fail |
|---|---|---|
| `npx tsc --noEmit --stableTypeOrdering` | exit 0 | fix_and_rerun |
| `npx vitest run` | exit 0, new 2458 + cluster tests green | fix_and_rerun |
| `GVBINDIR=/tmp/ghl PARITY_OUT=parity-rules.json npx tsx test/corpus/survey.ts` (fresh 15.1.0; `npm run survey` fails — tsx not on PATH) | 2458 → match | fix_and_rerun |
| `npx tsx test/corpus/rules-gate.ts` | regressions = 0 | stop |
| `git diff --name-only HEAD~N` | matches declared write-set only | stop |

## Batches

| Batch | Task | Status |
|---|---|---|
| 1 | [T1 — Investigate pack wiring + cluster oracle](batch-1/T1-investigate.md) | [x] |
| 2 | [T2 — Core doDot + per-component pack + 2458 (TDD)](batch-2/T2-core-pack.md) | [x] |
| 3 | [T3 — copyClusterInfo + cluster-carry (TDD)](batch-3/T3-clusters.md) | [ ] HALTED — scope (see journal) |
| 4 | [T4 — Survey verify + baseline refresh](batch-4/T4-survey-verify.md) | [x] (T2 scope) |

## Status (2026-06-27)

**Primary objective MET + EXCEEDED.** Batches 1–2 complete; halted at the T2/T3
boundary for a scope decision (see decision-journal T3 row).

- **T1** ✓ — wiring + cluster oracle pinned (`comparisons/T1-investigation.md`).
- **T2** ✓ — `doDot` pack branch (cluster-free path). **2458 diverged (maxΔ=74.8)
  → BYTE-MATCH** vs headless 15.1.0; **2682 bonus improvement**; **0 regressions**
  (gate: stable=672, improvements=2). tsc clean, full vitest green (2458 tests).
- **T3** ⛔ HALTED (attempted, reverted to green T2) — the cluster-carry itself was
  implemented dot-locally (cccompsWithClusters + projectG + copyClusterInfo,
  tsc-clean, 2458 stayed conformant), but laying out a clustered component crashes
  in the **cluster mincross core** via a cascade of component-vs-root assumptions
  (`rank.ts:expandRanksets` `g===g.root` vs C's `dot_root`; then
  `cluster.ts:mergeRanks`/`cluster-path.ts:makeSlots` root-rank indexing; likely
  more). Those are out-of-write-set edits in the most regression-prone subsystem —
  a dedicated derisk effort. Reverted source to the committed T2 state; gate GREEN;
  clustered graphs fall back via the `graphHasCluster` guard (no crash/regression).
  Full cascade map + cluster-carry approach are in the decision journal; oracle
  goldens kept at `test/golden/{inputs,refs}/pack-clusters-2592.*`. T4 (baseline
  refresh) pends this decision.

## Index

- [decisions.md](decisions.md) — ADR-1..5 (approved 2026-06-27)
- [decision-journal.md](decision-journal.md) — appended during execution
- [diagrams/data-flow.md](diagrams/data-flow.md) — doDot pack-branch sequence
- [diagrams/component-map.md](diagrams/component-map.md) — touched + reused modules
- Batch overviews: [1](batch-1/overview.md) · [2](batch-2/overview.md) · [3](batch-3/overview.md) · [4](batch-4/overview.md)
- `comparisons/` — T1 findings + T4 survey verification (created during execution)

## Memory pointers

- `parity-json-recipe-estimate-ghl` — parity.json is Estimate+ghl, NOT LUT; refresh
  via `cp parity-rules.json parity.json` + `dashboard.ts`.
- `concentrate-trunk-2559-done` — the prior smallest-diverged mission (same gate
  methodology + write-set STOP pattern).
