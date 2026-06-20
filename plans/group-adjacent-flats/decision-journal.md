# Decision Journal — group-adjacent-flats

Appended during execution (per `~/.claude/rules/autonomous-execution.md`).
One writer per row; parallel agents write their own findings file, the
orchestrator records the journal row after the batch.

| Task | Date | Decision | Rationale | Flagged |
|------|------|----------|-----------|---------|
| scope | 2026-06-20 | Brief authored from the merged `#241_0` diagnosis (7490f43). Fix = caller-side grouping of adjacent port-bearing flats into one `makeFlatAdjEdges(cnt=N)` call; aux internals already faithful. Locked AD-1 (pin C order — `edges[0]` must be the forward edge), AD-4 (regression gate: goldens byte-identical out-of-family + survey net-improve). Batch 1 = T1 derisk (pin order + red test); Batch 2 = T2 implement + T3 regression. | The ordering detail (`edges[0]`) and the shared-aux golden-risk are the two things that sank/feared prior missions — both locked before src edits. | no |
