# Data flow — concentrate merge → route → emit (2559)

The merge is correct; the trunk routing (highlighted) is the gap.

```mermaid
sequenceDiagram
    participant P as parser
    participant C as conc.ts (dotConcentrate)
    participant R as edge-route-chain.ts
    participant S as splines-route.ts (splineMerge)
    participant E as SVG emit

    P->>C: ranks built; rank1 = [a->b label, c->b vnode, d->b vnode]
    Note over C: bothupcandidates(c-vnode,d-vnode)=true ✓
    C->>C: mergeVirtual(r=1, UP) ✓ (in.size 1+1 → merged vnode in.size=2,out=1)
    C-->>R: merged virtual chain (c->b is representative; d->b drained in)
    rect rgb(255,235,235)
    Note over R,S: GAP — port breaks at splineMerge(vn) and routes each<br/>original directly; never emits the shared trunk segment
    R->>S: route c->b chain
    S--xR: spline_merge boundary not honored → single direct path
    end
    Note over R,S: C make_regular_edge: spline_merge(n)=true →<br/>beginpath/endpath split → 2-segment trunk + d->b stub
    R->>E: c->b (1 path) ✗   [native: c->b 2 paths + d->b joins]
```

## Native vs port (the visible delta)

| edge | native (dot 15.x) | port (current) |
|------|-------------------|----------------|
| `a->b` (label "1") | 1 path, not merged | 1 path ✓ |
| `c->b` (edge2) | **2 paths** (shared trunk) | 1 direct path ✗ |
| `d->b` (edge3) | short stub into trunk | 1 direct path ✗ |

`firstDiff = svg/g[1]/g[5][childCount]` = edge2 child-count (missing trunk path).
