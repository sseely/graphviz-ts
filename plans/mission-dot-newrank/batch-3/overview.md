# Batch 3 — removeFill + end-to-end parity (after T1, T2, T3)

Single task. Removes the placeholder nodes T3 inserted (so they don't render),
then pins end-to-end newrank parity against the oracle. This is the task that
closes the verified bug.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T4 | `removeFill` + newrank oracle parity | opus | `src/layout/dot/init.ts`, `src/layout/dot/newrank.test.ts` | T1, T2, T3 | [ ] |

Gate per [../README.md](../README.md). One commit. After the gate passes, merge
`feature/dot-newrank` → `main` with a **merge commit**.
- T4: `feat(T4): port removeFill + pin newrank rank-reconciliation parity`
