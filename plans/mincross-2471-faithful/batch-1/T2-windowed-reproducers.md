# T2 — Small windowed reproducers vs C; classify Layer 2

## Context

The vStart fix (T1) makes 2471 hang via transpose non-convergence, but 2471 is
too big to diagnose directly. This task determines whether the same
divergence/oscillation reproduces on a **small** windowed graph.

## Task

1. Build the C oracle harness (per `faithful-fix.md` "Harness"): repo's own
   `~/git/graphviz/build/cmd/dot/dot` + `/tmp/gvmine` plugins; instrument
   `dot_mincross` end with the **fingerprinted** per-rank dump
   (`v[upReal>downReal|clust]`). REVERT C after.
2. Construct two minimal repros that force `vStart>0`:
   - **multi-component:** ≥2 disconnected components sharing rank space (so
     comp≥2 gets `vStart>0`), each a few nodes.
   - **multi-cluster:** ≥2 small clusters on shared ranks (cluster windows get
     `vStart=ipos`).
   Make each large enough to exercise medians/reorder + transpose, small enough
   to NOT hang (target < a few seconds).
3. With the T1 fix applied, dump TS vs C per-rank order (fingerprinted) for each
   repro. Also run the per-rank/per-step **dup-order detector** (AD-3).

## Decisive output (write to ../decision-journal.md)
Classify Layer 2 as exactly one of:
- **(A) small-reproducible** — a small windowed graph diverges from C or shows
  dup-orders/oscillation. Capture the minimal repro + the first diverging
  rank/step. → Batch 2 diagnoses on this fast repro.
- **(B) 2471-scale-only** — all small windowed repros are **conformant to C**
  and converge. → Batch 2 must diagnose on 2471 with the convergence-point
  harness; record that small repros are clean (rules out a pure reorder bug).

## Write-set
- `plans/mincross-2471-faithful/decision-journal.md` (the classification)
- Temp-only: `~/git/graphviz/lib/dotgen/mincross.c` (reverted after)

## Read-set
- `../../mincross-2471-order-parity/faithful-fix.md` (harness recipe + dump code)
- `../../mincross-2471-order-parity/decision-journal.md` (what's already known)

## Acceptance criteria
- Given each repro, when dumped, then a fingerprinted C↔TS per-rank comparison
  exists for it.
- Given the run, then Layer 2 is classified (A) or (B) with evidence in the
  journal (minimal repro + first divergence, or "all small windowed clean").
- Given completion, then `git -C ~/git/graphviz status --porcelain lib/dotgen`
  is empty (C reverted).

## Observability / Rollback
N/A — diagnostic only; no production code changed (TS untouched here).

## Quality bar
No TS code change in this task (read-only diagnosis). Output is the journal
classification. No commit unless the repros are worth keeping as fixtures (if so:
`test(T2): windowed mincross reproducers`).
