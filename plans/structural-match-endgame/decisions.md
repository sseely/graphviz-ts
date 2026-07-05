<!-- SPDX-License-Identifier: EPL-2.0 -->
# Architecture decisions (pre-made, user-approved 2026-07-04)

- **D1 tie-break policy (ortho, NS families):** one bounded C-instrumentation
  pass per family; adopt C's tie-break iff portable-deterministic AND
  corpus-net-non-regressing; else document + accept (A3 precedent;
  "no-replication ≠ keep unfaithful mechanism").
- **D2 registry single-writer:** acceptance edits (accepted-divergences.json,
  docs/known-divergences.md, known-divergences-examples.test.ts) happen in the
  accepting family's own commit; at most ONE registry-writing task per batch.
- **D3 task structure:** unknown-locus families split diag→fix; diagnosis
  (worktree) outputs the mechanism doc whose proposedWriteSet journal-authorizes
  the paired fix task. Known-locus families (1949, decorate, portlabel) are
  single-task.
- **D4 survey cadence:** per-BATCH survey+gate (tasks validate locally:
  target ids diffed, controls, unit suite, typecheck). Gate fail → bisect.
- **Write-set expansion (user amendment):** needing files beyond the
  authorized set is not a hard stop — pause the family and ASK the user to
  expand, listing files and why. Other families continue.

## Diagnosis-doc interface contract (analysis/<family>.md)

mechanism (1-2 sentences) · origin file:line · causalChain · ruledOut[] with
evidence · verdict: fix|accept|already-closed · proposedWriteSet[] ·
evidence[] (repro commands, C-instrumentation dumps)
