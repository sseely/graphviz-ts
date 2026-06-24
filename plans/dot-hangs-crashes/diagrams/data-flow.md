<!-- SPDX-License-Identifier: EPL-2.0 -->

# Data flow

## Where the hotspot lives in the dot pipeline

```mermaid
flowchart LR
  parse["parse DOT<br/>(peggy) — T4"] --> rank["rank<br/>network simplex"]
  rank --> mc["mincross<br/>ordering"]
  mc --> pos["position<br/>x-coords (NS again)"]
  pos --> spline["splines"]
  spline --> svg["emit SVG"]

  rank -. "rank2Loop → nsUpdate → dfsRange<br/>(384M frames on 2471) — T1" .-> HOT[[hotspot]]
  pos  -. "x-coord NS also calls dfsRange/rerank — T1" .-> HOT
  mc   -. "reorderInner/accumCross — T3 (cond.)" .-> HOT2[[secondary]]
```

`dfsRange` is invoked from `nsUpdate` (`ns.ts:251`) on every simplex pivot, in
**both** the y-rank pass and the x-coordinate pass (the aux graph). That is why
it dominates: pivots × subtree-size = 384M frame-steps on 2471.

## Network-simplex pivot loop (the hot loop)

```mermaid
sequenceDiagram
  participant L as rank2Loop
  participant U as nsUpdate
  participant D as dfsRange (T1: flat stack)
  participant R as rerank (T1: iterative)
  loop until leaveEdge == none (≈59,861× on 2471)
    L->>U: leaveEdge e, enterEdge f
    U->>R: updateRerank(e, slack)
    U->>D: dfsRange(lca, par, low)
    Note over D: re-range subtree<br/>(per-frame object → flat array)
  end
```

The fix changes only **how** `dfsRange` stores its traversal frames and **how**
`rerank` recurses — never the loop count, pivot order, or computed ranks. Output
SVG is byte-identical; the survey gate (AD-4) enforces this.
