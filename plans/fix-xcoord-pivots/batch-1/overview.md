# Batch 1 — Pin the divergence

Produce comparable port-vs-native dumps of the x-coord network simplex, derive a
minimal reproducing graph, and record the exact first divergence (ADR-2). No
source-logic changes ship from this batch — only temporary gated probes, captured
dumps, and a committed fixture + decision-journal entry.

## Tasks

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Native C oracle dump (aux edges + per-pivot trace) | (orchestrator) | probes/README.md | — | [x] |
| T2 | Port-side dump, matching format | (orchestrator) | probes/README.md | — | [x] |
| T3 | Minimal repro + root-cause pin | (orchestrator) | __fixtures__/xcoord-pivot-divergence.gv, decision-journal.md | T1,T2 | [x] |

T1 and T2 have non-overlapping write-sets and run in parallel. T3 needs both.

## Exit criteria
- Native + port dumps exist in a comparable schema for `2475_2` and ≥1 small graph.
- A committed `<~50-node` fixture reproduces a ≥2× pivot gap.
- `decision-journal.md` names the exact first divergent stage (aux-edges /
  cutvalues / pivot-path), the file + function, and the C reference.
- If no minimal repro is found after reasonable experiments → STOP (see README).
