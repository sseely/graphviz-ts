<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: 1332 — root-cause and fix the 5-edge cluster-routing residual

## Objective

`1332.dot` renders on both sides (crash lineage closed by 3 prior missions);
verdict is `diverged` at `svg/g[1][childCount]`. Measured 2026-07-01: **nodes
0/91 differing, clusters 66/66 present, edges 5/117 differing** — and the
childCount pin is `c4251->c4253:In0`, which **the C oracle itself fails to
route** (`shortest.c:333 triangulation failed` → `Pshortestpath failed` →
`Error: lost c4251 c4253 edge`, exit 1) while the port routes it. The other 4
(`c3378:Out0->c4046:In1` piece-count 22v28, `c6428:Out0->c6753:In0` Δ126.3,
`c6412->c6414:In0` Δ2.6, `c4256->c4258:In0` Δ1.6) are presumed one shared
cluster-corridor mechanism until dumps say otherwise. Diagnose to a stated
mechanism, fix faithfully at the origin, resolve the lost edge per the D1
ladder (decisions.md), and refresh parity.

## Branch

`fix/1332-cluster-edge-routing` (from `main`). Merge back with a **merge
commit**; do not delete the branch (cleanup is batched).

## Constraints

**Interactive asks (pause for the answer, do not halt)**
- **Write-set expansion:** diagnosis or implementation implicates files
  outside the declared/provisional write-set → ASK (AskUserQuestion) with the
  implicated `file:line` list + mechanism artifact BEFORE editing. Approval
  expands the set (journaled); denial = document-and-halt for that locus.
  Applies mid-task.

**Stop conditions**
- Any other corpus id regresses (verdict, or an unexplained maxDelta rise /
  away-from-oracle move) vs committed HEAD in watch gate or survey.
- Same site changed 3× without converging on the same failing check.
- Two consecutive quality-gate failures on the same check.
- An "irreducible" claim without the forced-polygon controlled experiment
  (feed C's exact polygon to TS `shortestPath`).
- Code that special-cases graph 1332 or fakes a triangulation failure
  (contradicts D1).
- The 5 edges resolve to 3+ independent mechanisms → stop and re-scope.
- Any corpus graph pushed past the 180s survey cap.

**Push-forward (decide and log)**
- Instrumentation wording/format; the 2–3 extra watch graphs; whether T3
  collapses into T2; unit-test shape; guard-test syncs that follow the
  guard's own documented convention; journal phrasing; commit wording;
  warning-message text (mirror C's as closely as the port's channel allows).

## Quality gates

```
- command: npx tsc --noEmit
  pass: exit 0
  on_fail: fix_and_rerun
- command: npx vitest run
  pass: exit 0
  on_fail: fix_and_rerun (diagnose per diagnosis.md before any retry)
- command: 1332 per-element gate (title-keyed node/edge compare vs oracle;
           see batch-2/T2 for the recipe — compareSvg maxDelta is NOT
           trusted across childCount changes)
  pass: nodes 0; the 4 geometry edges 0 after T2; edge COUNT == oracle after
        T3 (or documented irreducible-fp disposition per D1)
  on_fail: stop
- command: survey + rules-gate vs COMMITTED HEAD parity.json
           (TSX_BIN=<npx-cached tsx> GVBINDIR=/tmp/ghl
            PARITY_OUT=parity-rules.json $TSX_BIN test/corpus/survey.ts &&
            $TSX_BIN test/corpus/rules-gate.ts)
  pass: exit 0; 0 regressions; every mover explained
  on_fail: stop
- command: git diff --name-only (per task)
  pass: only the task's declared (possibly expanded-by-ask) write-set
  on_fail: stop
```

Env notes: `node_modules/.bin/tsx` is absent — use the npx-cached tsx
(`~/.npm/_npx/*/node_modules/.bin/tsx`) with `TSX_BIN` set; invoke
`$TSX_BIN test/corpus/survey.ts` directly. `npm run survey:setup` builds
/tmp/ghl. C instrumentation: `~/git/graphviz/lib/{dotgen/dotsplines.c,
common/routespl.c,pathplan/shortest.c}`, `cd ~/git/graphviz/build && make
gvplugin_dot_layout`; /tmp/ghl symlinks it — **revert + rebuild +
byte-verify the oracle before any survey**. Note: the 1332 oracle exits 1
(its own lost-edge error) while emitting full SVG — capture output despite
the exit code, and byte-verify against that output.

## Batches

| Batch | Status | Doc |
|---|---|---|
| 1 — diagnosis (5 edges, C-first dumps) | [x] | [batch-1/overview.md](batch-1/overview.md) |
| 2 — faithful fix + lost-edge semantics + watch gate | [x] | [batch-2/overview.md](batch-2/overview.md) |
| 3 — survey, disposition, merge | [ ] | [batch-3/overview.md](batch-3/overview.md) |

## Index

- [decisions.md](decisions.md) — D1 lost-edge ladder, D2 C-first method,
  D3 scope/expansion protocol, D4 failure semantics, ops notes
- [batch-1/T1](batch-1/T1-diagnose-edge-divergence.md)
- [batch-2/T2](batch-2/T2-faithful-corridor-fix.md) ·
  [batch-2/T3](batch-2/T3-lost-edge-semantics.md) ·
  [batch-2/T4](batch-2/T4-watch-graph-gate.md)
- [batch-3/T5](batch-3/T5-survey-disposition-merge.md)
- [diagrams/data-flow.md](diagrams/data-flow.md) ·
  [diagrams/component-map.md](diagrams/component-map.md)
- [decision-journal.md](decision-journal.md)
- Prior evidence: `plans/cluster-membership-derisk/` (findings/root-cause/
  fix-plan; defects A–D lineage), `plans/cluster-expansion-recursion/README.md`
  (agDeleteFromCluster fix; 72/72 clusters ranked),
  `.agent-notes/nan-edge-endpoint-diagnosis.md` (dump recipe + 2-cycle lane
  lesson), `.agent-notes/b15-per-entry-run-routing.md` (compareSvg childCount
  blindness), memories `cl-bound-cluster-corridor-done`,
  `recover-slack-and-c-harness`, `instrument-c-before-quarantine`.
