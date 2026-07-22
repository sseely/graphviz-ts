<!-- SPDX-License-Identifier: EPL-2.0 -->
# Decision journal

Appended during execution. One row per non-trivial judgment call (per
`~/.claude/rules/autonomous-execution.md`).

| Date | Batch/Task | Decision | Rationale |
|------|-----------|----------|-----------|
| 2026-07-22 | Planning | Baseline `npm run typecheck` green before start | Pre-flight gate (Phase 8) — exit 0 confirmed |
| 2026-07-22 | Batch 1 | Branch `feature/docs-overhaul` from `main`; baseline `npm test` green (231 files / 3224 tests, exit 0) before launch | Establish clean base for batch gate + T1 byte-identical claim |
| 2026-07-22 | Batch 1 | Execution plan: 4 parallel agents (T1–T4) edit-only (no full test / no commit / no npm install except T3 which solely owns package.json); orchestrator runs batch gate once on combined tree, then commits each task's disjoint write-set separately | Disjoint write-sets confirmed in batch-1/overview.md; avoids git-index races and cross-contamination from concurrent full-suite runs on a shared working tree |
| 2026-07-22 | Batch 1 / gate-fix | Batch gate `npm test` failed 1/3255: `module-globals.fitness.test.ts` flagged T1's new `src/gvc/image-resolver.ts::activeResolver` as an unlisted module global. Fixed by adding it to the reviewed ALLOWLIST (twin of `usershape.ts::activeSizer`), folded into T1's commit | Not a workaround: the fitness test's own error message + AD-1 both sanction a process-wide DI resolver global; the allowlist entry is the documented review step for introducing one. Orchestrator-owned gate fix (test file in no task's write-set) |
| 2026-07-22 | Batch 1 | Ignored a persistent LSP "Cannot find module" diagnostic cascade across layout `index.ts`/`init.ts` throughout the batch | Flaky language server this session (T4 hit "No language servers available"); authoritative `tsc --noEmit` was clean at every checkpoint — deferred to the real typecheck, never the IDE diagnostics |
| 2026-07-22 | Batch 1 | Batch gate GREEN: typecheck exit 0 · `npm test` 3255 passed (234 files, +31 new: T1 17 + T2 14) · build exit 0 · `docs:api` exit 0 (emits setImageResolver + all public symbols, 15 expected internal-ref warnings). Committed T1 ef6cf8f, T2 28946af, T3 588f399, T4 d3d2f93 | Quality gates per README; one commit per task; write-sets verified disjoint via git status |
