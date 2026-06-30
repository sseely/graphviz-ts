# Batch 1 — Implement the ordering fix

Apply the fix at the site T0 pinned, so the port's in-rank order under
`ordering=out`/`in` matches C. Full-survey-gated (AD-3).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T1 | Fix the pinned divergence (constraint construction in `mincross-build.ts` and/or preservation in `mincross-order.ts` per T0) so b58 + ordering_dot1 in-rank order matches C; add `ordering=out`/`in` unit tests | debugger | per T0: `src/layout/dot/mincross-build.ts` and/or `src/layout/dot/mincross-order.ts` (+ co-located `.test.ts`) | T0 | [x] |

**T1 outcome:** Faithful root-cause fix landed in `fastgr.ts` (`copyVirtualEdgeInfo`
sets `e.seq = orig.seq`, mirroring C `new_virtual_edge`'s `AGSEQ(e)=AGSEQ(orig)`)
+ `model/edge.ts` (`seq` made mutable) + `mincross-build.ts` (sort reverted to the
faithful `a.seq - b.seq`) + new `ordering.test.ts`. Write-set deviated from T0's
pinned symptom file to the true root cause (user-approved; see decision journal).
Commit `bcecf61`. Survey GATE PASS, 0 regressions, `graphs-in` cleared
(structural→byte, conformant 492→493). b58 node 7 fixed (5 left of 4); its 3/6/8
residual and the other ordering graphs (ordering_dot1, pgram, trapeziumlr, 1472)
remain diverged on a SEPARATE flat-enforcement cause (documented, AD-5).

Execution rule: implement exactly what T0 pinned. Re-render `graphs/b58.gv` and
`linux.x86/ordering_dot1.gv`; confirm per-node `<text>` x matches C
(b58 target: `{1:27,6:45,3:81,2:99,8:117,5:171,7:207,4:243}`). Then run the full
survey gate. **Any conformant→worse is STOP + revert (AD-3)** — the 12
already-matching `ordering` graphs are canaries. Batch done = b58 + ordering_dot1
node order == C AND survey 0 regressions AND tsc + vitest green.

Write-set note: the file(s) are fixed by T0's pinning, not pre-decided (AD-2). If
both construction and preservation need changing they are one task / one commit.
