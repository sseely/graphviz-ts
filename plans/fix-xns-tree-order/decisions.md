<!-- SPDX-License-Identifier: EPL-2.0 -->
# Architecture decisions

## ADR-1: Match C's tight_tree edge-add order exactly (not a "stable equivalent")
- **Context:** the port's `Tree_edge` list order diverges from C, changing
  `LR_balance`'s degenerate-vertex selection. We could (a) replicate C's exact
  add order, or (b) impose some other deterministic order and accept different
  (still-optimal) vertices.
- **Decision:** replicate C's exact order. The project bar is byte-match to C
  (CLAUDE.md: "the C source is the spec"); a "different but valid" optimum still
  diverges in the SVG and fails the gate.
- **Consequences:** the fix is a faithful port of C's subtree-merge ordering
  (`find_tight_subtree` DFS order, the subtree heap `stExtractMin` tie-break, and
  `inter_tree_edge` selection). Higher fidelity, but must match C's iteration
  order precisely; verified by the add-order diff (Batch 0) and the survey.

## ADR-2: Diagnose before editing (Batch 0 is read-only instrumentation)
- **Context:** the divergence could be in DFS order, heap tie-break, or inter-tree
  edge selection — three different fixes.
- **Decision:** Batch 0 pins the FIRST add-order divergence and the exact C rule
  before any code change. No port edits until the locus is known.
- **Consequences:** avoids speculative edits to a shared NS core. Batch 1's
  write-set is confirmed by Batch 0's finding.

## Rollback
Trivially **reversible** — revert the commit. No data, schema, or external state.
The survey gate (Batch 2) is the safety net; nothing merges with a regression.

## Not applicable (deterministic in-process layout algorithm)
Observability/SLI, on-call, scalability envelope, API/backwards-compat, migrations
— none apply. The only externally-observable contract is the SVG, validated by the
parity survey.
