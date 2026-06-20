# Batch 1 — Harness + input-parity

Two independent diagnosis tasks. T1 is runtime (build the dump harness, validate
on a synthetic repro). T2 is static (read C vs port aux construction). They write
disjoint files and may run in parallel.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Build + canary the aux rank/chain dump harness on a minimal synthetic repro | debugger | `test/diagnostic/flat-aux-dump.ts`, `test/diagnostic/flat-back-port.dot`, `plans/flat-aux-curl-diagnosis/findings-harness.md` | — | [x] |
| T2 | Static input-parity diff: C `make_flat_adj_edges` construction vs port `buildFlatAux`/`cloneGraph` | debugger | `plans/flat-aux-curl-diagnosis/findings-input-parity.md` | — | [x] |

Both append a row to `decision-journal.md` **via the orchestrator after the
batch** (not from inside the parallel agents — one writer per file).

Parallel-safe: write-sets are disjoint. Both read the same C and TS sources
(read access is unrestricted).

Exit criteria for the batch:
- T1: the harness reproduces the agreeing forward `2->3` case (size 7) on both C
  and port (canary green), and emits a `3->2` rank/chain dump for both sides.
- T2: a suspect-ranked list of aux-construction input gaps, with the
  `rank=source` subgraph explicitly confirmed present-or-absent in the port.
