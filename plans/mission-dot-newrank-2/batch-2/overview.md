# Batch 2 — Faithful fixes (after T1 trace)

Two tasks. T2 is the trivial, independent dispatch fix. T3 is the faithful
double-install fix derived from T1's trace. They write different files and can
run in parallel, BUT T3's exact write-set is set by T1's findings — if T1 names
a file T2 also touches, collapse them. (Default: T2 = `rank.ts`, T3 = the
mincross/cluster file T1 names — disjoint.)

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T2 | `dotRank` reads the `newrank` attr | opus | `src/layout/dot/rank.ts`, `src/layout/dot/rank.test.ts` | T1 | [ ] |
| T3 | Faithful fix for the cross-cluster double-install (per T1) | opus | the file T1 names (within AD-3 set) + its test | T1 | [ ] |

Commits:
- T2: `fix(T2): dotRank honours the newrank attribute`
- T3: `fix(T3): <faithful change per C trace> (no cross-cluster double install)`

⚠️ Do NOT commit T2 alone to a state where `newrank=true` HANGS. T2 + T3 must
land together (or T3 first) so newrank renders without hanging. If T3 is not
ready, hold T2.
