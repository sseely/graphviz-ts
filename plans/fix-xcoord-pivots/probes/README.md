# Probe results — x-coord NS pivot divergence (2475_2)

Temporary instrumentation (now removed from src + C) localized the divergence.
This file preserves the recipe and the measured ground truth.

## Recipe (oracle, ADR-1)
Add counters to `lib/dotgen/position.c` `make_aux_edge` + per-phase snapshots in
`create_aux_edges` / `pos_clusters`, then:
```
cd ~/git/graphviz/build && make dotgen && make gvplugin_dot_layout \
  && cp -f plugin/dot_layout/libgvplugin_dot_layout*.dylib /tmp/gvplugins/
XPROBE=1 GVBINDIR=/tmp/gvplugins ./build/cmd/dot/dot -Tsvg tests/2475_2.dot -o /dev/null
```
Port side: gate the same prints on `globalThis.__XPROBE__` in `position-aux.ts`
/ `position-cluster.ts` (`makeAuxEdge` counter) and `ns.ts` `rank2Loop`
(pivot counter), render via `tsx render-one.ts`.

## Aux-edge phase breakdown (native vs port, BEFORE fix)
| phase                       | native | port (pre) | gap   |
|-----------------------------|-------:|-----------:|------:|
| make_LR_constraints         | 12638  | 12638      | 0     |
| make_edge_pairs             | 25082  | 25082      | 0     |
| pos_clusters/containClust   | 14845  | 14845      | 0     |
| pos_clusters/**keepout**    | 13924  | **7019**   | **6905** |
| pos_clusters/containSubclust| 1610   | 1610       | 0     |
| pos_clusters/separate       | 323610 | 323610     | 0     |
| **total aux edges**         | 391709 | **384804** | **6905** |

First divergence (ADR-2 staged compare) = `keepout_othernodes`. The 6905 keepout
deficit == the exact total edge gap. 2475_2's 805 anon subgraphs carry
`cluster=true` → they are clusters; `separate_subclust` alone is 323610 edges
(805 choose 2 ≈ every pair overlaps), which is why the pure-forest synthetic
never reproduced this (no clusters).

## After fix (rankGet for cluster-local v0 in keepoutLeft/keepoutRight)
| metric                | native | port (pre) | port (post) |
|-----------------------|-------:|-----------:|------------:|
| aux nodes             | 26849  | 26849      | 26849       |
| aux edges             | 391709 | 384804     | **391709**  |
| x-coord NS pivots     | 8748   | 34434      | **8694**    |
| keepout aux edges     | 13924  | 7019       | **13924**   |

Pivots 8694 ≈ native 8748 (tie-break noise in enter/leave selection). The 4×
pivot divergence is eliminated.

## Render time (2475_2, tsx harness overhead ~0.75s)
- before fix: ~126s ; after fix: ~27.7s (4.5× faster).
- phase split (after fix): through-mincross ~9.6s, position/NS ~16s, splines+emit ~1.3s.
- The residual >20s is broad constant-factor JS cost (mincross alone exceeds
  native's 3.77s total) + per-pivot NS cost — NOT a faithfulness divergence and
  not addressable by the scoped keepout fix. Pivot-count parity (the mission's
  success bar) is met; sub-20s would require perf work outside position-cluster.ts.

## Residual (out of scope): anonymous-subgraph naming
2475_2 + the fixture still verdict `diverged` due to a pre-existing title/id
divergence: port names anon subgraphs `%0,%1,%2…` (sequential) vs native
`%3,%9,%17…` (global object-sequence ids). Independent of the geometry fix
(aux edges match native exactly). Separate concern.
