<!-- SPDX-License-Identifier: EPL-2.0 -->

# Batch 2 — fresh re-sweep + residual triage (gate)

Single task, no `src/` edits. Establishes the authoritative post-B1 residual set
that Batch 3 consumes. Because B1 moved node positions, the raw B2/B4/B5 counts
will shrink (cascades collapse) — do not trust the pre-B1 lists.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T2 | Fresh full neato sweep; regenerate parity-neato.json; re-triage residual into B2/B3/B4/B5; write residual-tracker.md | self (no src edits) | `test/corpus/parity-neato.json`, `plans/neato-close-diverged/residual-tracker.md` | T1 | [ ] |
