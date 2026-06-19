# Decision Journal — dot-multiport

Appended during execution (per `~/.claude/rules/autonomous-execution.md`).

| Task | Date | Decision | Rationale | Flagged |
|------|------|----------|-----------|---------|
| Plan | 2026-06-19 | Handle T1+T2 inline (opus orchestrator), not via sub-agents. | Sequential single-batch faithful-port work; delegation would lose C-vs-TS context fidelity. Per CLAUDE.md "handle directly under ~30 min". | — |
| T1 | 2026-06-19 | Verdict **CONFIRMED**; AD-4 does not fire. `tail_port.p.x` = +27/−27/0 (populated) at mincross time. | Drove repro through `renderSvg` with env-gated probe in `accumCross` (reverted). p.x populated → comparator fix suffices. | — |
| T1 | 2026-06-19 | **Correction to README premise:** `port.order` is NOT 0 — it is 192/64/0 (C `compassPort` angular order, shapes.c:2865/2868). | README claimed "order=0, signal lost". Reality: order is the *wrong* signal (angular), not absent. C ties by `p.x`; TS ties by `port.order`. Same fix. Recorded so a maintainer is not confused by order≠0. | ⚑ premise correction |
