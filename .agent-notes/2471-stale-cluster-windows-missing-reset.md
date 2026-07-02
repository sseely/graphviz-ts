<!-- SPDX-License-Identifier: EPL-2.0 -->
# 2471 inputs verification (T2, verify-oracle-bug-family)

Method: 2796 dump recipe. DUMPFAM (rank2-entry constraint dump, nodes
identified by nlist position), DUMPFAM2 (contain/keepout site dump),
DUMPFAM3 (root rank arrays at pos_clusters), DUMPFAM4 (per-reset window
dump inside rec_reset_vlists with per-rank membership bitstring).

## Verdict

```json
{
  "inputs": "match (ranking) / diverge (x-coord aux) — GENUINE PORT DEFECT",
  "evidence": "253 rank2 calls; calls 0-251 (rankings) LINE-IDENTICAL. Call 252 (x-aux, balance=2, N=8637) differs in 51 weight=0 cluster-wall edges (contain_nodes ln→v0 / v[n-1]→rn and keepout_othernodes u→ln / rn→u): different boundary-node choices, shifted orders (±1..5), one window count 17 vs 16, different vnode widths (1 / 10 / 18 / 16.8).",
  "mechanism": {
    "cause": "The port's flatEdges skips C's rec_reset_vlists(g) call. When non-adjacent labeled flat edges insert label vnodes (flat_node) during dot_position, root rank orders shift; C re-derives every cluster rank window (rankleader + vStart + n via furthestnode); the port keeps the stale pre-insertion windows.",
    "origin": "src/layout/dot/flat.ts:flatEdges (comment: 'deferred (DOT-5 AD-4)' — needs a MincrossContext); C ref lib/dotgen/flat.c:333",
    "causalChain": "stale windows → contain_nodes/keepout_othernodes read wrong v0/v[n-1]/outside-neighbors → 51 divergent wall aux constraints → different x-solve → measured layout divergence + squeezed spline corridors → port loses 9 edges via Pshortestpath failures (oracle loses 6 from its OWN acknowledged init_rank recovery; 5 losses in common).",
    "ruledOut": [
      "ranking constraint inputs (calls 0-251 line-identical)",
      "root rank in-rank identity order and node widths at pos_clusters (DUMPFAM3 identical)",
      "membership predicates / furthestnode logic (C's FIRST rec_reset_vlists at mincross end is byte-identical to the port's only reset: 0 diff over 344 lines)",
      "C's SECOND reset (flat.c:333) vs first: 124 changed lines — exactly the window updates the port never applies"
    ]
  },
  "fixLocus": ["src/layout/dot/flat.ts:flatEdges — add the faithful recResetVlists call (needs only {root: dotRoot(g)})"]
}
```

## Retroactive implication for 2796 (A4 disposition)

2796's accepted 'wall-edge variant' (makeLrvn/keepout C 26/24.8 vs TS
18/18) decomposes as margin 8 + widths 18/16.8 (label vnodes) vs 10 —
the same stale-window signature. The A4 entry's 'port variant' is this
same missing call, NOT a benign local length difference. The inherited
T6 question is answered: **C computes the faithful values**; the port's
variant comes from a skipped C call and it DOES mislay layouts (port
loses 9 edges on 2471 vs oracle's 6).

## Policy tension (user attention)

Fixing faithfully will feed C-identical x-aux constraints on the family
graphs → the port will reproduce C's acknowledged aux-graph cycle
(#2796/#2471, draft !4849) and lay out from the equivalent silent
recovery state. That collides with the 'never replicate
xfail-acknowledged C bugs' policy IF read as output-replication; it is
mandated by CLAUDE.md faithfulness + the brief's 'fix genuine input
defects faithfully' IF read as no-bug-chasing. Executed per the brief
(fix), with the tension documented for review.
