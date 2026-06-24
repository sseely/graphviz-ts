# Oracle: cgraph anonymous-id model (confirmed)

Native `dot -Tsvg` `<title>%N>` for controlled `cluster=true` inputs.

| input | titles | decode |
|---|---|---|
| anon-root, 1 cluster, 1 edge | %3 | root(0→1) cluster=2·1+1=3 |
| **named**-root, 1 cluster, 1 edge | %1 | root named=no advance; cluster=2·0+1=1 |
| anon-root, 2 clusters (1 then 2 edges) | %3 %7 | c1=3; +1 edge → c2=2·3+1=7 |
| nested clusters | %3 %7 | inner allocated after a→b: 2·3+1=7 |
| node-only clusters | %3 %5 | nodes don't advance: c2=2·2+1=5 |
| strict dup edge (a→b a→b) | %3 %7 | strict merges dup → no advance |
| non-strict dup edge | %3 %9 | dup counts → c2=2·4+1=9 |
| multi-hop a→b→c | %3 %9 | 2 edges → c2=9 |
| subgraph edge-endpoint `{x y}->z` | %3 %13 | endpoint-subgraph adds EXTRA anon objects |

## Model (id.c idmap anon branch + agmapnametoid)
- one per-parse counter, start 0; anon object id = `2*counter+1`, then `counter++`.
- ADVANCES: unnamed root graph; each anonymous subgraph (at open, before body);
  each keyless edge actually created (cgraph order = parse order).
- DOES NOT advance: named root/subgraph, named nodes, strict-merged duplicate
  edges, keyed edges.
- name materialized lazily as `'%'+id`; only clusters surface it in SVG `<title>`.

## Port gaps (builder.ts) — fixed in T3
1. edges never advance the counter (processEdgePair).
2. anon root never consumes id 1 (buildFromAst).
3. formula sequential `%N`, not `%(2·counter+1)`.

## Out of scope (documented limitations, not in 2475_2 / verdict-relevant corpus)
- strict-duplicate edges: port doesn't dedup at build → would over-advance.
- subgraph-as-edge-endpoint: port doesn't create that anon subgraph object.
