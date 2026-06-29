# Data flow — `ordering` enforcement through mincross

How the `ordering` attribute is supposed to constrain in-rank node order, and
where the port may diverge (the Batch-0 suspects are marked).

```mermaid
sequenceDiagram
    participant M as dot_mincross / mincross.ts
    participant OE as ordered_edges / orderedEdges
    participant DON as do_ordering_node / doOrderingNode
    participant FE as FLATORDER constraint edges
    participant BR as build_ranks (initial order)
    participant ST as mincross_step (median + transpose)
    participant POS as in-rank order (result)

    M->>OE: init (graph-level ordering=) 
    OE->>OE: recurse subgraphs
    OE->>DON: per node with ordering (out/in)
    DON->>FE: install order constraints between consecutive targets
    Note over DON,FE: SUSPECT A — wrong constraint set/order (mincross-build.ts)
    M->>BR: build initial ranks
    BR->>ST: iterate passes
    ST->>POS: median + transpose reorder
    Note over ST,POS: SUSPECT B — passes drop the ordering constraint → drift (mincross-order.ts)
    POS-->>M: final order (port: 4 left of 5; C: 5 left of 4 on b58)
```

Batch 0 (T0) instruments both DON (constraint set) and POS-after-each-pass
(drift) on b58 to decide whether the first divergence is Suspect A or B.
