# Batch 1 — Investigate

Single task, read-only (probes reverted). Pins the exact divergence point and
the T2 write-set before any code is changed. This is the de-risking gate: if the
fix locus is outside the expected routing files, **stop**.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Pin exact merged-trunk routing divergence; emit findings + T2 interface | debugger (Sonnet) | `plans/fix-concentrate-2559/comparisons/T1-investigation.md` | — | [ ] |

Output of T1 feeds T2's write-set and unit-test assertion shape.
