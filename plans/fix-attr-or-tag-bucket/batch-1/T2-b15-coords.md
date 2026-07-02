<!-- SPDX-License-Identifier: EPL-2.0 -->
# T2 — b15 coordinate divergence (re-diagnose)

## Context
b15 maxΔ 1033 in 2-path edge groups, same order, deep-coordinate diff.
Prior note claims 1pt node x-coord amplified by routeSplines — predates
2026-07-02 fixes (CL_CROSS, group penalty, rec_reset_vlists, ortho) —
re-verify from scratch: node coords first, then corridor inputs.

## Task
1. Compare node geometry port vs oracle (byte-level). 2. If nodes match,
instrument the routing corridor inputs for the first diverging edge; if
they differ, chase the x-coord input (NS aux dump recipe from
.agent-notes/2796-ns-inputs-verification.md). 3. Classify per D3:
bounded (fix in ≤2 files) or deep (disposition).

## Acceptance criteria
- Given the artifact, then mechanism + D3 verdict stated with evidence.
- Given nodes diverge, then the divergence is traced to constraint
  inputs, not asserted.

## Rollback / Observability
N/A. Reversible.

## Commit
`docs(T2): b15 divergence — <mechanism + bounded|deep>`
