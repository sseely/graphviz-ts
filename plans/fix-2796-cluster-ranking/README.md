<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: 2796 — root-cause the cluster-layout divergence; fix to conformant

## Objective

**REDUCED SCOPE (user decision 2026-07-02, see decision-journal):** verify,
then accept — do NOT port C's error-recovery layout. `2796.dot` is an OPEN
upstream bug (`trouble in init_rank` → recovery-state layout with 5
overlapping cluster pairs + a lost edge; `xfail(strict=True)` in C's own
suite; only fix attempt is draft MR !4849, perf-contested, unmerged — it
targets #1213/#1939/#2796 together). The port already satisfies every
expectation in the issue (0 overlapping clusters, 213/213 edges, silent NS).
The one open question with value beyond 2796: **does the constraint graph
the port feeds NS match C's?** (right-for-the-right-reason check — an input
defect would silently mislay the still-diverged cluster family 2471/2475_2/
b51). T1 answers it with one instrumentation round. Inputs match → dispose
of 2796 as an accepted oracle-bug divergence citing the upstream evidence.
Inputs diverge → THAT defect (not the recovery state) becomes the fix, with
the usual expansion asks. Baseline side-by-side:
[comparisons/2796-cluster-ranking.md](comparisons/2796-cluster-ranking.md).

## Branch

`fix/2796-cluster-ranking` (from `main`). Merge back with a **merge
commit**; do not delete the branch (cleanup is batched).

## Constraints

**Interactive asks (pause for the answer, never halt)**
- **Write-set expansion:** implicated files outside the declared/provisional
  write-set → ASK (AskUserQuestion) with `file:line` + mechanism artifact
  BEFORE editing; denial = document-and-halt for that locus only. Applies
  mid-task.
- **Re-scope checkpoint:** T1's input diff reveals 3+ independent
  mechanisms → present findings + options (fix all / split follow-up /
  dispose now and pin mechanisms for later).

**Stop conditions**
- Any other corpus id regresses (verdict, or unexplained away-from-oracle
  move) vs committed HEAD in watch gate or survey.
- Same site changed 3× without converging on the same failing check.
- Two consecutive quality-gate failures on the same check.
- An "irreducible" claim without that layer's forced-inputs experiment
  (feed C's layer output into the port's next phase).
- Code that special-cases 2796, fakes the `init_rank` diagnostic without
  the underlying state, or suppresses an edge without a real corridor
  failure (contradicts D1/D2).
- Any corpus graph past the 180s survey cap (2475_2 is the canary).
- Implementation contradicts decisions.md.

**Push-forward (decide and log)**
- Instrumentation wording/format; virtual-node name-mapping recipe for the
  inputs diff; the 2–3 extra watch graphs (Batch 2 only); unit-test shape
  (incl. "no small repro — corpus-gated", 1332 precedent); guard-test syncs
  per the guards' own conventions; accepted-class naming (R-oracle-bug vs
  extending R-oracle); whether the disposition needs a survey (check
  accepted.ts scope semantics); journal phrasing; commit wording.

## Quality gates

```
- command: npx tsc --noEmit
  pass: exit 0
  on_fail: fix_and_rerun
- command: npx vitest run
  pass: exit 0
  on_fail: fix_and_rerun (diagnose per diagnosis.md before any retry)
- command: 2796 inputs gate (T1 recipe)
  pass: the NS constraint graph (nodes, aux edges, minlens, weights) diffed
        line-wise C vs TS — verdict stated either way; if DIVERGE, the fix's
        gate is inputs-match after T2 (recovery-state layout is NOT a target)
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

Env notes: use the npx-cached tsx (`~/.npm/_npx/*/node_modules/.bin/tsx`)
with `TSX_BIN`; invoke `$TSX_BIN test/corpus/survey.ts` directly.
`npm run survey:setup` builds /tmp/ghl. C instrumentation:
`~/git/graphviz/lib/{common/ns.c, dotgen/rank.c, dotgen/cluster.c,
dotgen/mincross.c, dotgen/position.c}`; `cd ~/git/graphviz/build && make
gvplugin_dot_layout`; /tmp/ghl symlinks it — **revert + rebuild +
byte-verify the oracle before any survey**. The 2796 oracle exits 1 by
design (`trouble in init_rank` + `lost 3 16 edge` on stderr, full SVG on
stdout) — capture stdout regardless and byte-verify against it.

## Batches

| Batch | Status | Doc |
|---|---|---|
| 1 — verify NS constraint inputs vs C | [x] | [batch-1/overview.md](batch-1/overview.md) |
| 2 — CONDITIONAL: fix input defect + watch gate (skip if inputs match) | [x] (skipped) | [batch-2/overview.md](batch-2/overview.md) |
| 3 — disposition (accepted oracle-bug class), survey, merge | [x] | [batch-3/overview.md](batch-3/overview.md) |

## Index

- [decisions.md](decisions.md) — D1 layered ladder, D2 init_rank fork + checkpoint,
  D3 layer-ordered dumps, D4 scope, ops notes
- [batch-1/T1](batch-1/T1-diagnose-layers.md)
- [batch-2/T2](batch-2/T2-input-defect-fix.md) ·
  [batch-2/T4](batch-2/T4-watch-graph-gate.md)
- [batch-3/T5](batch-3/T5-survey-disposition-merge.md)
- [diagrams/data-flow.md](diagrams/data-flow.md) ·
  [diagrams/component-map.md](diagrams/component-map.md)
- [decision-journal.md](decision-journal.md)
- [comparisons/2796-cluster-ranking.md](comparisons/2796-cluster-ranking.md)
  (+ .html side-by-side; pre-mission baseline, upstream xfail evidence)
- Prior evidence: `.agent-notes/1332-edge-routing-diagnosis.md` (dump
  recipe; lost-edge machinery DONE — reuse, don't rebuild),
  `.agent-notes/xcoord-ns-lrconstraints-int-truncation.md` (RESIDUAL 2:
  2796 = 213v212 edges, cluster-block shift),
  `plans/cluster-membership-derisk/` (defect lineage; membership FIXED),
  `plans/cluster-rank-c-parity/`, memories
  `2471-blocker-is-cluster-ranking`, `errored-cluster-rc2-rc3-are-membership`,
  `cluster-ns-perf-2475` (NS hot-path perf), `instrument-c-before-quarantine`.

## Mission summary (2026-07-02)

**Outcome: verified + accepted (D1 outcome 1). No src changes.**

- T1: ranking inputs MATCH (44/44 NS calls line-identical, 2923 edges). The
  init_rank failure is the X-COORD aux graph: C's cyclic (91 unscanned) vs
  port acyclic; divergence pinned to makeLrvn + keepoutOthernodes wall-edge
  lengths (position-cluster.ts:61/:184 vs position.c:1052/:392).
- Upstream: #2796 xfail(strict=True); only fix attempt = draft !4849
  (perf-contested). Port output meets every expectation in the issue
  (0 overlapping cluster pairs vs C's 5; 213/213 edges; silent NS).
- Disposition: new A4 accepted class (entry + full §A4 doc write-up with
  line-pinned links both repos) — 2796 moves from tracked gaps to accepted
  deltas; re-measure when upstream fixes it.
- Related family documented (related-diverged-items.md): 2471, 1939, 1435
  all xfail upstream; graphs-structs same signature; 18 other diverged ids
  have clean oracles. Follow-up mission authored:
  plans/verify-oracle-bug-family/.
- Gates: tsc 0; vitest 2552/2552; guards 11/11; comparison page verified
  current; C tree + TS dumps reverted, oracle stdout byte-verified. No
  survey needed (no src or verdict-input changes).
- Batch 2 skipped (inputs match). Journal rows: 10.
