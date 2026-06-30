<!-- SPDX-License-Identifier: EPL-2.0 -->
# Architecture decisions

1. **Write-set pinned by Batch 0, not pre-assigned.**
   - Context: the root cause of the L→U over-segmentation is unknown until the C
     vs port routing is instrumented; guessing the file risks editing the wrong
     layer.
   - Decision: Batch 0 produces a structured finding naming `fixTarget`
     (`<file>::<function>`); Batch 1's write-set is exactly that. Mirrors the
     fix-xns-tree-order mission.
   - Consequences: no code changes in Batch 0; Batch 1 is unblocked only after
     the finding exists. A stop-condition fires if the locus is outside the
     edge-spline-routing surface.

2. **C is the spec; reproduce its box corridor / piece count exactly.**
   - Context: the port over-segments L→U (14 vs 8 pts).
   - Decision: match C's routing (`dotsplines.c` / chain router) faithfully —
     preserve function boundaries and iteration order; no "smoother" rewrite.
   - Consequences: the fix is a faithful correction, not an optimization.

3. **"Conformant" is the bar.** Per [`docs/conformance.md`](../../docs/conformance.md):
   L→U must match C within ±0.01 on numeric path values, non-numeric content
   exactly. K→L is expected to resolve as a downstream consequence.

4. **Reversibility: fully reversible.** Layout-geometry change, no schema/API/
   data migration. Rollback = revert the merge. The survey IS the verification.
