# Decision Journal — DOT-newrank-2

Appended during execution (per ~/.claude/rules/autonomous-execution.md).

| Task | Date | Decision | Rationale | Flagged |
|------|------|----------|-----------|---------|
| Plan | 2026-06-17 | Mission scoped from orchestrator-verified diagnosis: dispatch bug (rank.ts), double-install hang (c in root rank 1 via root + cluster0 buildRanks), file-size debt (mincross-build.ts 529>500). User chose faithful-first (deep C study before fixing) + Batch-0 split. | De-risk #2 by porting C faithfully, not patching. | no |
| T0 | 2026-06-17 | Split flat-edge group → mincross-flat.ts; re-export keeps importers stable. 353/206 lines. Commit 859aa64. Gates green, goldens byte-identical. | Unblock in-session edits (500-line hook cap). | no |
| T1 | 2026-06-17 | C trace (debugger agent, commit 12c3cda) named the divergence: `markClusters` guard `ranktype != 0` skips undefined-ranktype nodes; C's ND_ranktype defaults to NORMAL(0) (calloc). Fix INSIDE allowed write-set (cluster.ts). Orchestrator independently verified the claim by applying the fix and observing 122 goldens byte-identical + exact repro parity. | AD-1 faithful-first; re-verified agent claim before building on it. | no |
| T2/T3 | 2026-06-17 | Two faithful one-liners: T3 `(ranktype ?? 0) !== 0` (cluster.c:317), T2 `mapbool(g.attrs.get('newrank'))` (rank.c:523). Committed T3 (0cd33af) BEFORE T2 (d7e457f) so HEAD never hangs (T3 golden-safe alone; T2 alone would hang). | Faithful port of C's NORMAL-default + attr dispatch; safe commit order. | no |
| T4 | 2026-06-17 | Flipped newrank.test.ts residual → oracle parity pins (repro + flag-drives-it + 2nd corpus case, both oracle-verified ≤0.5pt). Closed comparisons/newrank.md (RESOLVED). Commit 46576f0. | Objective met; AD-3 3-fix cap not approached (1 logic fix). | no |
| Done | 2026-06-17 | Full parity achieved; merged feature/dot-newrank-2 → main with a merge commit. Final: tsc 0, vitest 1842/0, 122 goldens byte-identical, lizard clean. | Mission complete; merge per brief on successful gate. | no |
