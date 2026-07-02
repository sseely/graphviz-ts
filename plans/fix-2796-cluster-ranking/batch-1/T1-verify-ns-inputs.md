<!-- SPDX-License-Identifier: EPL-2.0 -->
# T1 — Verify the NS constraint inputs match C (REDUCED SCOPE)

## Context
`~/git/graphviz/tests/2796.dot` — open upstream bug (see decisions.md#d1
and comparisons/2796-cluster-ranking.md; read both first). The port's
layout is the issue's EXPECTED behavior; the only question with value is
whether the port's clean solve comes from faithful inputs (D2). No fix
work in this task; no recovery-state porting ever (D1).

## Task
0. Verify the baseline comparison page still matches fresh renders of both
   sides (regenerate + journal if HEAD moved them).
1. Instrument C (`dotgen/rank.c` / `dotgen/cluster.c` / `common/ns.c`) with
   env-gated `DUMP2796` dumps of: cluster collapse/leader sets; every
   aux/constraint edge handed to rank2/NS (tail, head, minlen, weight);
   and which nodes/edges init_rank reports unscanned. Mirror the same
   dumps in TS. Diff line-wise (match by node names; virtual naming may
   need a mapping pass — journal the recipe).
2. State the verdict: INPUTS-MATCH (mod naming) or INPUTS-DIVERGE (first
   differing constraint, with both sides' lines). If diverge: pin the
   mechanism per diagnosis.md (cause, origin file:line, causal chain,
   ruled-out) — that becomes Batch 2's spec; write-set expansion asks
   apply if the origin is outside batch-2's provisional set.
3. Revert C tree, rebuild plugin, byte-verify oracle stdout unchanged.
4. Write `.agent-notes/2796-ns-inputs-verification.md`; journal a summary.

## Interface contract (consumed by T2/T5)
```
verdict = {
  inputs: "match" | "diverge",
  evidence: "diff summary / first differing constraint",
  mechanism?: { cause, origin: "file:line", causalChain, ruledOut[] },
  fixLocus?: string[]
}
```

## Write-set
`.agent-notes/2796-ns-inputs-verification.md`,
`plans/fix-2796-cluster-ranking/decision-journal.md`;
TEMPORARY `~/git/graphviz/lib/**` and TS dumps (both end reverted).
No production `src/**` edits.

## Acceptance criteria
- Given the dumps, when diffed, then the verdict is stated either way with
  the evidence attached (a bare assertion is not done).
- Given inputs=diverge, then the mechanism artifact is complete per
  diagnosis.md (empty ruledOut = not done).
- Given T1 completes, then the C tree is clean and the oracle stdout
  byte-matches pre-instrumentation.

## Observability / Rollback
N/A. Reversible; C revert is part of the task.

## Commit
`docs(T1): verify 2796 NS constraint inputs vs C — <match|diverge>`
