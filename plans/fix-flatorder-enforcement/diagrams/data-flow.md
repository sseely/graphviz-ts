# Data flow — FLATORDER enforcement: C vs port

How a built FLATORDER constraint (e.g. `6->8` from node 3's `ordering=out`) is
turned into in-rank order, and where C and the port diverge.

```mermaid
sequenceDiagram
    participant DON as do_ordering_node
    participant FE as FLATORDER edge (6->8)
    participant BR as build_ranks / enqueue_neighbors
    participant FR as flat_reorder / flat_search
    participant POS as in-rank order

    DON->>FE: build FLATORDER 6->8 (weight 0 in C, weight 1 in port)
    Note over FE: construction now correct in both (prior mission)

    rect rgb(220,240,220)
    Note over BR,POS: C path
    FE-->>BR: weight-0 edge does NOT drive flat_reorder
    BR->>POS: install order from node 3's ND_out walk → 6 before 8
    FE-->>FR: SKIPPED (constraining_flat_edge & flat_search: weight==0)
    end

    rect rgb(240,225,225)
    Note over BR,POS: port path (divergent)
    FE-->>FR: weight-1 edge IS constraining → flat_reorder reorders
    FR->>POS: produces 8 before 6 (WRONG)
    BR->>POS: port build_ranks install order may also differ
    end
```

Batch 0 (T0) captures BOTH the post-build_ranks install order and the
post-flat_reorder order, in C and port, to localize whether the flip happens in
`build_ranks` (install order) or in `flat_reorder` (weight-1 reordering) — the two
SUSPECT sites Batch 1 will target.
