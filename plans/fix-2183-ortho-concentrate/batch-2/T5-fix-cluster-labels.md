<!-- SPDX-License-Identifier: EPL-2.0 -->
# T5 — Faithful fix: cluster labels

## Context
Mechanism from T2 (.agent-notes/2183-cluster-labels.md). Provisional
locus: device-cluster.ts emit or dot cluster-label placement.

## Task
Mirror C at the origin. Regression test asserting `<text>` A/B/C for
2183 (or minimal repro).

## Acceptance criteria
- Given 2183, when rendered, then cluster labels A, B, C are emitted at
  oracle-matching positions.
- Given labelclust-*/clust* corpus cases, when surveyed (T6), then no
  regressions attributable to this change.

## Observability / Rollback
N/A. Reversible.

## Commit
`fix(T5): <mechanism> — 2183 cluster labels`
