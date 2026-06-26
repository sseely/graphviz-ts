# Component map — affected spline-routing components

```mermaid
graph TD
  subgraph C[C reference — lib/dotgen, lib/common]
    DS[dotsplines.c: dot_splines_]
    MRE[make_regular_edge]
    SELP[setEdgeLabelPos / place_vnlabel]
    MBB[maximal_bbox / rank_box]
    RS[routespl.c: routesplines]
    RSL[recover_slack]
    SPL[splines.c: bezier emit/clip]
    DS --> SELP --> MRE --> MBB --> RS --> RSL --> SPL
  end

  subgraph P[Port — src/layout/dot]
    PSPL[splines.ts: dotSplines]
    PLAB[splines-label.ts]
    PCHAIN[edge-route-chain.ts]
    PFAITH[edge-route-faithful.ts]
    PBOX[edge-route-boxes.ts]
    PROUTE[splines-route.ts]
    PCLIP[edge-route-clip.ts]
    PSPL --> PLAB --> PCHAIN --> PBOX --> PFAITH --> PROUTE --> PCLIP
  end

  MRE -.faithful port.-> PCHAIN
  SELP -.faithful port.-> PLAB
  MBB -.faithful port.-> PBOX
  RS -.faithful port.-> PFAITH
  SPL -.faithful port.-> PCLIP

  classDef suspect fill:#fde,stroke:#c39;
  class MRE,SELP,MBB,PCHAIN,PLAB,PBOX suspect;
```

Pink = primary suspects (labeled-edge routing, label-node placement, box
corridor → fitter piece count). Follow the oracle; the real site may be any
node on the chain.
