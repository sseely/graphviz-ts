# Component map

New public layer (green) over untouched internals (grey). Arrows = "depends on".

```mermaid
graph TD
  subgraph entries[Package entries — ADR-2]
    ROOT["graphviz-ts (root)<br/>src/index.ts (T9)"]
    API["graphviz-ts/api<br/>src/api/index.ts (T7)"]
    REND["graphviz-ts/render<br/>src/render/index.ts (T8)"]
  end

  subgraph newapi[New api layer]
    BUILD["builder.ts (T4)"]
    GEO["geometry.ts (T3)"]
    EOPS["edge-ops.ts (T2)"]
  end
  subgraph newrender[New render layer]
    RPUB["public.ts render() (T5)"]
    XPUB["xdot-public.ts (T6)"]
    DCTX["gvc/default-context.ts (T1)"]
  end

  subgraph internal[Internal — untouched, C-faithful]
    MODEL["model/ Graph·Node·Edge·info·geom"]
    OPS["model/cgraph-ops.ts agnode/agsubg"]
    RENDERERS["render/ svg·dot·json·map factories"]
    XDOT["xdot/ parse·emit"]
    CTX["gvc/context.ts GvcContext"]
  end

  ROOT --> API & REND
  API --> BUILD & GEO & EOPS
  REND --> RPUB & XPUB
  BUILD --> EOPS & OPS
  EOPS --> MODEL
  GEO --> MODEL
  RPUB --> DCTX
  XPUB --> DCTX & XDOT
  DCTX --> CTX & RENDERERS
```

Only `src/index.ts` and `package.json` are **modified** (T9). Everything else in
the new layers is **created**. Internals are read-only for this mission.
