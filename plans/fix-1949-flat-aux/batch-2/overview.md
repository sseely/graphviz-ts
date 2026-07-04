# Batch 2 — Fix (after T2 pins the cause)

Apply the minimal faithful fix in `splines-flat.ts` only, add a regression
test, and prove 0 corpus regressions + 1949 improvement.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T3 | Apply minimal faithful fix + regression test + full survey verify | direct (opus) | `src/layout/dot/splines-flat.ts`, `src/layout/dot/splines-flat.test.ts`, `.agent-notes/1949-diagnosis.md` | T2 | [ ] |

**Gate to enter Batch 2:** T2 produced a pinned cause whose `fixLocus` is
inside `splines-flat.ts`. If `fixLocus` is "STOP — needs sameport.ts", do NOT
start T3; surface to the human (AD-3).
