# Batch 3 — Apply the faithful fix + unit test

Single sequential task. Depends on T2's localized divergence point.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T3 | Port the faithful fix at the localized site; pin with a unit test | orchestrator (debugger) | the T2-named file (+ test) | T2 | [ ] |

Exit criterion: honda-tokoro's 2 divergent edges (piece count + control points)
and their edge-label positions byte/structural-match native; `npm run typecheck`
+ `npm test` green. Port instrumentation removed. The exact write-set file is
whatever T2 named; if it is outside the provisional set, the write-set-expansion
rule was already cleared in T2.
