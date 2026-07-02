<!-- SPDX-License-Identifier: EPL-2.0 -->
# 1939 inputs verification (T3, verify-oracle-bug-family)

Method: DUMPFAM rank2-entry dumps (2796 recipe) + DUMPFAM5 build_ranks
pre/post-transpose order+ncross traces.

## Verdict

```json
{
  "inputs": "match after two dotInitEdge fixes — line-identical to C",
  "evidence": "All 6 rank2 calls (incl. x-aux balance=2 N=19) line-identical post-fix; every build_ranks pass trace and ncross value identical. Post-fix the port is structurally CONFORMANT to the oracle (compareSvg pass).",
  "mechanism": {
    "cause": "Two dot_init_edge misports: (1) the same-group penalty (xpenalty=CL_CROSS, weight*=100) fired on SELF-LOOPS — C's `tailgroup == headgroup` interned-pointer compare was misread as tail==head; (2) CL_CROSS=100 used C's _WIN32 branch, oracle platform uses 1000.",
    "origin": "src/layout/dot/init.ts:isSelfLoop/applyGroupPenalty + CL_CROSS; C refs lib/dotgen/dotinit.c:66-72, lib/common/const.h:141-147",
    "causalChain": "missing ×100 weights + wrong xpenalty → different NS ranking objective on group edges + mincross crossing counts off by 100× (10100 vs 1001000) → different best-order selection on the group-penalty plateau → rank-0 cluster blocks swapped → 4 divergent wall/keepout/nodesep aux edges → different x-solve.",
    "ruledOut": [
      "build_ranks walk direction (TS mirrors C's cluster backward walk)",
      "rank2/NS core (line-identical inputs → identical traces post-fix)",
      "flat.c reset (1939 has no labeled flat edges; F1 not implicated)"
    ]
  },
  "fixLocus": ["src/layout/dot/init.ts (commit 7ec6555)"]
}
```

## Disposition note

Post-fix 1939 is **conformant to the broken oracle**: identical x-aux
inputs mean the port receives the same cyclic aux graph C's init_rank
complains about ("trouble in init_rank"). The port's initRank handles
cyclic input silently and behaviorally equivalently (unscanned nodes
keep initial ranks), so both sides lay out identically; the port just
lacks the stderr diagnostic and exits 0. Policy question (replicating
an acknowledged-broken outcome) flagged in the mission report.
