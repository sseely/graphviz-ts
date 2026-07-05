# T12 — 2413_1+2413_2 outcome (from analysis/2413-vspace.md)
model: fable · needs: the paired Batch-1 diagnosis

## Task
Read analysis/2413-vspace.md. verdict=fix → implement exactly at the stated origin
within proposedWriteSet (journal-authorize; ASK to expand beyond it);
add a focused regression test. verdict=accept → registry trio per today's
pattern: accepted-divergences.json entry + docs/known-divergences.md prose +
DOC_CLAIMS_DIVERGENT guard line (only ONE registry task per batch — this
batch: T13 only; any other accept verdict defers its registry write to the
next batch and journals that). verdict=already-closed → journal + check off.

## Quality bar
Target ids improved/accepted; family controls 0-diff; vitest+tsc clean; one
commit. Local validation only — the survey runs at the batch gate.

**SCOPE EXTENSION (2026-07-04):** T8 concluded graphs-decorate is the same A3 findMaxDev/hypot-tie family — include it in the same registry entry set (accepted-divergences.json entries for 2413_1, 2413_2, graphs-decorate; one known-divergences.md A3 prose extension; three DOC_CLAIMS_DIVERGENT guard lines). Evidence: analysis/2413-vspace.md + analysis/decorate.md.
