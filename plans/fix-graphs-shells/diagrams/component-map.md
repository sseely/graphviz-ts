<!-- SPDX-License-Identifier: EPL-2.0 -->
# Component map

```mermaid
flowchart TD
  subgraph dot[dot layout pipeline]
    rank[ranking — y-coords ✓ match oracle]
    mc[mincross — within-rank L-R order]
    xc[x-coord NS — node x positions]
    sp[splines — edge paths]
  end
  rank --> mc --> xc --> sp

  subgraph mincross_files[src/layout/dot]
    order[mincross-order.ts<br/>init order · medians · transpose]
    flat[mincross-flat.ts<br/>flat-group order enforcement]
    loop[mincross.ts<br/>iteration loop · best-order capture]
    cross[mincross-cross.ts<br/>crossing count]
  end
  mc -. origin candidates .-> order
  mc -. origin candidates .-> flat
  mc -. origin candidates .-> loop

  mc -->|"3 flat ranks swapped"| symptom["symptom: edge spline g[27] @d maxΔ264<br/>(downstream of swapped node x)"]
  xc --> symptom
  sp --> symptom

  classDef bad fill:#fdd,stroke:#c00;
  classDef ok fill:#dfd,stroke:#090;
  class mc,symptom bad
  class rank ok
```

The fault is in `mincross` (one of the three candidate files); everything
downstream (x-coord, splines) is faithful and merely propagates the swapped node
order into the reported edge-spline delta.
