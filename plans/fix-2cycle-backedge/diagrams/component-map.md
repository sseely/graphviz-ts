<!-- SPDX-License-Identifier: EPL-2.0 -->
# Component map — fix 2-cycle back-edge

```mermaid
graph TD
  A["class2 processes back edge<br/>e = b→a"] --> B["handleBackEdge"]
  B -->|"BUG: outEdges(e.head)<br/>= n.info.out (FAST graph)"| C["opp = FAST edge a→b<br/>to_virt = undefined"]
  C -->|"to_virt undefined →<br/>makeChain(opp)"| D["redundant 2nd chain<br/>→ stray a→b(w1) + a→b(w2)"]

  B -->|"FIX: e.head.outEdges(g)<br/>= original cgraph edges"| E["opp = ORIGINAL edge a→b<br/>to_virt already set"]
  E -->|"to_virt set → skip makeChain"| F["merge b→a into existing<br/>→ single a→b(w2)"]

  D --> G["+1 stray aux edge in<br/>make_edge_pairs → x-NS<br/>constraint graph differs"]
  G --> H["within-rank arrangement<br/>diverges (NaN, 1447_1, …)"]
  F --> I["matches native"]

  classDef bug fill:#f8cecc,stroke:#b85450
  classDef fix fill:#d5e8d4,stroke:#82b366
  class C,D,G,H bug
  class E,F,I fix
```

C reference: `lib/dotgen/class2.c:259` iterates `agfstout(g, aghead(e))`
(original cgraph edges). The port's `class1` already does this
(`classify.ts:144`); only `class2`'s `handleBackEdge` regressed to the fast graph.
