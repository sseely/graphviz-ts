<!-- SPDX-License-Identifier: EPL-2.0 -->
# Architecture decisions

1. **Write-set pinned by Batch 0, not pre-assigned.**
   - Context: the X-divergence locus (cluster mincross ordering vs x-coord NS vs
     cluster containment) is unknown until C-vs-port instrumentation; guessing
     the file risks editing the wrong layer.
   - Decision: Batch 0 produces a structured finding naming `fixTarget`
     (`<file>::<function>`); Batch 1's write-set is exactly that. Mirrors the
     fix-graphs-mike mission.
   - Consequences: no code changes in Batch 0; Batch 1 is unblocked only after
     the finding exists. A stop-condition fires if the locus is outside the
     ordering / x-coord / cluster surface.

2. **C is the spec; reproduce its ordering / x-coord exactly.**
   - Context: the port reorders n518 within its rank and shifts 13 nodes in X.
   - Decision: match C's mincross / position / cluster code faithfully —
     preserve function boundaries and iteration order; no "cleaner" rewrite.
   - Consequences: the fix is a faithful correction, not an optimization. Note
     the precedent from fix-graphs-mike: if the locus is a stable-sort-vs-libc-
     `qsort` tie, use `src/util/bsd-qsort.ts:gvQsort` (still STOP first to confirm
     the scope expansion, per stop-condition 1).

3. **"Conformant" (±0.01) is the bar.** Per `../../docs/conformance.md`:
   ldbxtried node X + dependent edge paths must match C within ±0.01, non-numeric
   content exactly. The edge point-count diffs are expected to resolve once node
   X is correct → edges are a downstream check, not a separate fix target.

4. **Reversibility: fully reversible.** Layout-geometry change, no schema/API/
   data migration. Rollback = revert the merge. The survey IS the verification.

5. **Scope: fix `graphs-ldbxtried`; `share`/`windows` verified in the survey.**
   - Context: share/windows-ldbxtried are pos-annotated sibling graphs.
   - Decision: target graphs-ldbxtried; the Batch 2 survey reports whether the
     siblings also improve (not a hard gate).
   - Consequences: siblings are a reported outcome, not a blocker.
