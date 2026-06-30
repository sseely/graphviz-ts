<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 1 — Diagnosis (gated)

Pin the exact mincross stage where the port's within-rank order first diverges
from C for `shells`, and whether crossing counts are equal (tie-break bug) or
worse (heuristic miss). **Ends with a hard STOP** — report the mechanism
artifact and wait for human confirmation before Batch 2.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T1 | Instrument C + port mincross order dumps for shells; pin origin + crossing-count parity; write mechanism artifact | debugger | `plans/fix-graphs-shells/decision-journal.md` (+ temporary, reverted instrumentation) | — | [x] |

No parallelism (single task). T1 may add **temporary** tracing to C
(`~/git/graphviz/lib/dotgen/mincross.c`, rebuild) and to port mincross files,
but must revert all instrumentation before the batch is marked done — the only
durable output is the decision-journal mechanism artifact.
