# Batch 1 — Capture C 4-stage oracle dump

Single sequential task. No port changes. Output feeds Batch 2.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Instrument C x-coord NS; dump 4 stages for honda-tokoro | orchestrator (debugger) | C source (temp), `oracle/c-dump.txt` | — | [x] |

Dependency summary: none (mission entry point).

Exit criterion: `oracle/c-dump.txt` contains the 4 stages (aux graph, pivots,
pre-balance x, post-balance x) with node IDs mappable to port node names
(n000..n022). C instrumentation stays in place until T4 (reverted there).
