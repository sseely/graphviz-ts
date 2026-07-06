<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 2 — Outcome (exactly one task, chosen by T1's verdict) + survey gate

Dispatch T2a OR T2b based on T1's verdict. If verdict=split, do NOT auto-run —
surface both mechanisms to the user and re-scope.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T2a | Implement the localized ortho fix (if verdict=fix) | sonnet (worktree) | T1's src/ortho/*.ts + colocated *.test.ts | T1 | [ ] |
| T2b | Register the divergence (if verdict=accept) | sonnet (worktree) | accepted-divergences.json + docs/known-divergences.md + known-divergences-examples.test.ts | T1 | [ ] |

Specs: [T2a-fix.md](T2a-fix.md) · [T2b-accept.md](T2b-accept.md)

## Batch-2 gate (orchestrator-run, after T2a/T2b lands on its branch)
1. Combined `tsc --noEmit` + `vitest run` on an integration branch.
2. Survey on an OTHERWISE-IDLE box + rules-gate → 0 regressions.
   Standalone-verify any maxΔ=0.0 timeout flip before calling it a regression.
3. Squash-merge the branch to main via the integration branch, push, delete.
4. Snapshot refresh (cp parity-rules.json parity.json + dashboard), commit, push.

Expected: verdict=fix → 2620 diffs/maxΔ improve (ideally → conformant, 755);
verdict=accept → 2620 stays structural-match with a registry entry, conformant
count unchanged at 754. Either way, no other case regresses.
