<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: root-cause and fix `2183` (ortho + concentrate + cluster labels)

**Status: COMPLETE (2026-07-02). Outcome: 2183 diverged → CONFORMANT; 0 regressions.**

## Objective

`2183` is `diverged` (maxΔ 248, firstDiff `svg/g[1][childCount]`).
Pre-mission verification (2026-07-02) pinned three symptom classes vs the
headless oracle on `~/git/graphviz/tests/2183.dot` (`concentrate=true` +
`splines=ortho` + 3 clusters + xlabels):

1. **2 edges missing from the port**: `a->b` and `o->r` (19 vs 21 edge
   groups; both sides exit 0 with the same ortho warning).
2. **All 3 cluster labels missing**: `<text>` A, B, C absent (18 vs 21).
3. **Numeric deltas** (maxΔ 248) on shared elements.

Root-cause each class per `~/.claude/rules/diagnosis.md`, apply faithful
C-spec fixes at the origin, restore 2183 toward conformant with zero net
parity regressions.

## Branch

`fix/2183-ortho-concentrate` from `main`. Merge with a **merge commit**;
keep the branch (cleanup is batched by the user).

## Constraints (approved 2026-07-02)

- **D1** Batch 1 is a GATED diagnosis: stop and report all mechanisms
  before any `src/` edit.
- **D2** Faithful port at origin; no per-graph special cases; instrument
  C before hypothesizing. C refs: `lib/dotgen/conc.c`, `lib/ortho/*`,
  cluster-label placement/emit (`lib/common/emit.c`, `lib/dotgen/cluster.c`).
- **D3** Numeric residual may be closed as the documented ortho maze
  corridor tie-break class (2361/2620) ONLY with equal-cost evidence.
- **D4** Main-loop sequential execution (shared mutable C tree).

### Stop conditions
- Batch 1 gate (report mechanisms, then continue to fixes per approved plan).
- Fix locus outside the provisional write-set → ask (never halt).
- A fix regresses any currently-conformant corpus id → stop.
- Lost edges / labels trace to an ORACLE-side bug → stop, rescope to the
  A4 disposition pattern (2183 has no upstream xfail — unexpected).
- 2 consecutive gate failures on one check; same location changed 3× for
  the same failing check → stop.

### Push-forward
Instrumentation/dump formats; test phrasing; which candidate file hosts
a fix once the origin is pinned; journal wording.

## Quality gates

```
- command: npx tsc --noEmit                       | pass: exit 0 | fix_and_rerun
- command: npx vitest run                          | pass: exit 0 | fix_and_rerun
- command: GVBINDIR=/tmp/ghl PARITY_OUT=parity-rules.json npx tsx test/corpus/survey.ts
           && GVBINDIR=/tmp/ghl npx tsx test/corpus/rules-gate.ts
  pass: gate exit 0, 0 regressions (≤2 survey runs total)  | stop
- command: re-render 2183 | pass: 21 edges incl. a->b,o->r; <text> A,B,C present | stop
- command: canary: render-one 2475_2 | pass: <180s (only if routing/position code changed) | stop
- command: git diff --name-only | pass: within declared write-sets + corpus baselines | stop
```

Baseline refresh recipe: survey → gate → `cp test/corpus/parity-rules.json
test/corpus/parity.json` → `npx tsx test/corpus/dashboard.ts`.

## Batches

- [x] [Batch 1 — gated diagnosis](batch-1/overview.md): T1 lost edges,
      T2 cluster labels, T3 delta attribution
- [x] [Batch 2 — faithful fixes](batch-2/overview.md): T4 edges, T5 labels
      (write-sets provisional until the gate)
- [x] [Batch 3 — verify + close](batch-3/overview.md): T6 survey, baseline,
      comparison page (if any acceptance), summary, merge

## Index

- [decisions.md](decisions.md) · [decision-journal.md](decision-journal.md)
- [diagrams/component-map.md](diagrams/component-map.md) ·
  [diagrams/data-flow.md](diagrams/data-flow.md)
- Pre-mission evidence: session of 2026-07-02 (renders + title/text diffs;
  reproduced in batch-1 task specs).

## Operational readiness (recorded, approved)

Library port: SLIs/dashboards/on-call **N/A** — the parity survey + rules
gate is the observability. Rollback: **Reversible** (branch merge revert).
Scalability: N/A. Backwards compat: none (output moves toward the C
reference; only corpus baselines change).


## Mission summary (2026-07-02)

Two faithful fixes, one commit each; 2183 moved **diverged → conformant**.

- **T1–T3 (gate):** single root for all three symptom classes —
  `infuseAllNodes` fed fast-graph segments to the chain walk, leaving
  vnode-only cluster ranks leaderless → `dotConcentrate` -1 →
  `dotPosition` early-return (no x-solve, no cluster geometry). Write-set
  re-scoped to conc.ts at the gate.
- **T4a (df0fa57):** iterate original cluster out-edges (conc.c:146).
  Covered T5's label symptom too.
- **T4b (e38aa17):** post-T4a residual failed the D3 equal-cost test
  (m->e dangled) → second mechanism: bend-at-end segment built from
  stale cp/prevbp/bp1 (C advances them first, ortho.c:182-203).
- **T6:** canary 18s; survey+gate PASS (1 mover: 2183→conformant, 0
  regressions, clip-watch −1); baseline/PARITY.md refreshed; oracle
  byte-verified after C revert; tsc 0; vitest 2556/2556 (2 new
  regression tests, both red/green-verified).
