# Batch 1 — Implement the enforcement fix

Apply the fix at the site T0 pinned, so the port enforces FLATORDER the way C does
and b58's middle-rank order (6 before 8) matches C. Full-survey-gated (AD-3).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T1 | Fix the pinned enforcement divergence (per T0: `build_ranks`/`enqueueNeighbors` install order in `mincross-build.ts`, and/or `newVirtualEdge` orig=null defaults in `fastgr.ts`, and/or `flat_reorder`/weight handling in `mincross-flat.ts`) so b58 3/6/8 in-rank order matches C; add unit tests | debugger | per T0 | T0 | [x] |

**T1 outcome.** T0 pinned the divergence to `left2right` (NOT the files this row
guessed): the flat constraint matrix is built indexed by `low` but was read by
`order - vStart`. Fix (`src/layout/dot/mincross-cross.ts`, `left2right` only):
read the matrix by `v.info.low`/`w.info.low`, matching the build basis and C's
`flatindex(v)=ND_low(v)`. Kept the port's fused both-direction check; rejected the
agent's `g.info.flip` swap as behaviorally inert (both consumers test only `!==0`).
Added 3 unit tests (`mincross-cross.test.ts`) pinning that the lookup uses `low`
even when `order` drifts. b58 node x == C exactly (middle rank `6,8,7`). **Survey
GATE PASS, 0 regressions, 4 improvements** (b58→structural-match, ordering_dot1×3→
conformant; byte 493→496). Write-set: `mincross-cross.ts` + `mincross-cross.test.ts`.

Execution rule: implement exactly what T0 pinned (AD-4: reproduce C's model, do not
invent a port-only enforcement path). Re-render `graphs/b58.gv`; confirm middle-rank
order is `6,8,7` and node x matches C
(`{1:27,6:45,3:81,2:99,8:117,5:171,7:207,4:243}`). Then run the full survey gate.
**Any conformant→worse is STOP + revert (AD-3)** — the node-7 fix, `graphs-in`, and
the 12 already-matching `ordering` graphs are canaries. Do NOT repeat the naive
FLATORDER-weight=0 change in isolation (it broke node 7 — see decisions.md ground
truth); weight-0 must be paired with the install-order fix that makes it correct.

Batch done = b58 3/6/8 order == C AND survey 0 regressions AND tsc + vitest green.
Write-set fixed by T0's pinning, not pre-decided (AD-2); construction + enforcement
changes that must stay consistent are one task / one commit.
