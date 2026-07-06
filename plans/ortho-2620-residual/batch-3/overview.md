<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 3 — Closeout (orchestrator inline)

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T3 | Final gate + snapshot + docs + memory | orchestrator | README, decision-journal, PARITY.md, parity.json, memory | T2 | [ ] |

## T3 steps
1. Confirm the Batch-2 survey gate is green and the snapshot is refreshed
   (parity.json + PARITY.md regenerated, committed, pushed).
2. README.md: append the mission summary (before/after verdict, mechanism,
   conformant count). Close decision-journal.md.
3. Memory (~/.claude/projects/.../memory/):
   - New file for this mission's outcome (mechanism or accepted class).
   - Update followup-residuals-done.md's backlog note: 2620 residual
     CLOSED (fixed → conformant, or accepted → class X).
   - Update MEMORY.md index.
4. Retire/annotate any now-stale ortho memory notes if the fix contradicts
   them (e.g. a corridor tie-break note).

## Acceptance criteria
- **Given** the mission is done, **when** T3 completes, **then** parity.json +
  PARITY.md reflect the final 2620 verdict and are pushed to main.
- **Given** the outcome, **then** a memory file records the mechanism/class and
  the followup-residuals backlog note is updated.
