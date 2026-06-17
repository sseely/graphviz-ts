# Comparison — DOT-5: checkLabelOrder / fixLabelOrder

## What it does

Per rank, `checkLabelOrder` collects flat-edge label vnodes (`info.posAlg`
set) and, when a rank has >1, runs `fixLabelOrder`: build interval-conflict
edges between the label intervals `[lo, hi]` (endpoint orders), and for each
connected component containing a backedge, reassign `np.order` / `rank.v[]`
to the topological order over the component's original positions.

## Verification (C ground truth, not an approximation)

The reorder is unreachable in normal input — **0 of 300 graphviz corpus
graphs** triggered it; only `tests/2471.dot` (35k lines, HTML tables +
clusters, which the TS port can't render) does. So instead of an e2e oracle
pin, the algorithm is pinned against C ground truth dumped from the
instrumented C binary for `tests/2471.dot` rank 9.

**Input** (7 LabelNodes, `idx → [lo, hi]`):
```
159→[104,190] 178→[190,239] 179→[190,307] 180→[190,312]
194→[141,190] 260→[190,202] 261→[159,190]
```

**C reorder** (position ← original order): `159←159 178←194 179←261
180←178 194←179 260←180 261←260`.

**Port:** `fixLabelOrder` reproduces this mapping **exactly** (test
"fixLabelOrder — C parity (2471.dot rank 9)", `MATCH=true`).

## Verdict

**MATCH** to C on the only known real trigger. The entry point (posAlg
filter, lo/hi extraction with swap) is covered by the `checkLabelOrder`
tests. Full suite 1864 passed, zero golden churn (the reorder fires for no
golden). `recResetVlists` (cluster-only) is deferred per AD-4 — it needs a
MincrossContext not threaded to the position-phase `flatEdges` call.
