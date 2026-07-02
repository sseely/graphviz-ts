<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 2 — faithful fix + watch gate

**Entry condition:** T2 classification = `port-defect`. If `irreducible`,
skip to Batch 3 (T5 handles the reclassification path per decisions.md#d1).

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T3 | Faithful fix at the mechanism's origin + regression test | main session (opus) | PROVISIONAL: `src/layout/dot/{edge-route*.ts, splines-route*.ts}`, `src/common/splines-clip.ts` + matching `.test.ts` — subject to the write-set expansion protocol (decisions.md) driven by T2 `fixLocus` | T2 | [x] |
| T4 | NaN-family + watch-graph gate | main session | `.agent-notes/` only | T3 | [x] |

T3 and T4 are serial (T4 gates T3's output). Collapse into one agent if the
fix locus is a single module. Gate after batch: tsc, full vitest, goldens,
NaN per-element gate (0/0 on all 3 dirs). One commit per task (T4 commits
only if it produces a note).
