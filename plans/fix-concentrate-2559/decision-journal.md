# Decision Journal — fix-concentrate-2559

Append one row per non-trivial judgment call during execution.

| When | Task | Decision | Rationale |
|------|------|----------|-----------|
| 2026-06-27 | setup | Branch `fix/concentrate-2559` off main; untracked `plans/` carried over | Per README; merge-commit on completion |
| 2026-06-27 | B1 | Start Batch 1: T1 (read-only investigation, run inline; subagent dispatch declined by user) | Single de-risking gate per batch-1/overview.md |
| 2026-06-27 | T1 | **STOP — write-set assumption broken.** Fix locus is `splines.ts` (`dotSplines_` gather loop iterates `g.nodes.values()` = real nodes only; merge node lives in `g.info.nlist`. Probe: `g.nodes real=4 virt=0 merge=0 \| nlist real=4 virt=2 merge=1`). Trunk `vMERGE->b` never gathered → c->b gets 1 bezier not 2. | README stop condition #1 + T2 boundary "STOP if fix needs a file outside the 3 routing files". `splines.ts` is the load-bearing change; `conc.ts`/`classify.ts` confirmed correct. Findings: comparisons/T1-investigation.md. Awaiting human write-set decision. |
