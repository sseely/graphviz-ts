# Decision journal

Appended during execution. Every non-trivial judgment call, every write-set
expansion approval, and the T2 localization result go here.

| When | Batch/Task | Decision / Finding | Rationale |
|------|-----------|--------------------|-----------|
| 2026-06-26 | T1 | Inline orchestrator (not subagent) for T1–T4 | Oracle-harness context (instrument→rebuild→diff) must persist across batches; subagent would lose it (cf. [[Subagent hook-loop deaths]]). |
| 2026-06-26 | T1 | C instrument gated on `getenv("GV_XDUMP")` | Inert unless env set → shared oracle stays clean even pre-revert; positions in position.c create_aux_edges (Stage1) + ns.c rank2 balance==2 (Stage2 pivots, Stage3 pre, Stage4 post). |
| 2026-06-26 | T1 | C dump captured: 115 nodes, 165 aux edges, 18 pivots, all 4 stages | honda renders fine; named x at Stage3/4 fully comparable (n000..n023). LR_balance moves nodes (e.g. n011-15 102→90, n023 42→21). Exit criterion met. |
