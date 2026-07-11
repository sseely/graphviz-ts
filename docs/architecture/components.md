<!-- SPDX-License-Identifier: EPL-2.0 -->

# Component Diagrams

## graphviz-ts (this project)

`src/` mirrors the C Graphviz module layout. Porting proceeds bottom-up:
container types → graph model → shared rendering utilities → layout engines →
context/plugin layer → render. Non-test `.ts` file counts are shown per module.

```mermaid
graph TD
    subgraph Foundation["Foundation (container + model)"]
        CDT["cdt/ (8)<br/>dict/tree/list containers"]
        RBTREE["rbtree/ (1)<br/>red-black tree"]
        MODEL["model/ (11)<br/>Graph / Node / Edge"]
        PARSER["parser/ (4)<br/>Peggy DOT grammar"]
    end

    subgraph Shared["Shared rendering utilities"]
        COMMON["common/ (68)<br/>color · labels · arrows<br/>htmltable · emit"]
        LABEL["label/ (7)<br/>label layout / text measure"]
        UTIL["util/ (6)"]
    end

    subgraph LayoutEngines["layout/ (114) — 8 engines"]
        DOT["dot/ (primary)<br/>acyclic→rank(ns)→mincross<br/>→position→splines"]
        NEATO["neato/ · fdp/ · sfdp/"]
        RADIAL["twopi/ · circo/"]
        CLUST["osage/ · patchwork/ · pack/"]
    end

    subgraph Geometry["Geometry support"]
        PATHPLAN["pathplan/ (7)<br/>edge routing"]
        ORTHO["ortho/ (14)<br/>orthogonal routing"]
        VPSC["vpsc/ (9)<br/>constraint solver"]
    end

    subgraph Output["Context + render"]
        GVC["gvc/ (7)<br/>GvcContext · device · plugins"]
        RENDER["render/ (18)<br/>svg · json · dot · plain · map"]
        XDOT["xdot/ (5)<br/>draw-op model"]
        APILAYER["api/ (4)<br/>createGraph · getLayout"]
    end

    PARSER --> MODEL
    CDT --> MODEL
    RBTREE --> MODEL
    MODEL --> LayoutEngines
    LayoutEngines --> Geometry
    Geometry --> LayoutEngines
    Shared --> LayoutEngines
    LayoutEngines --> GVC
    GVC --> RENDER
    RENDER --> XDOT
    APILAYER --> MODEL
    APILAYER --> GVC

    style DOT fill:#cde4ff,stroke:#3b6ea5
```

### dot engine internal flow (the primary fidelity target)

```mermaid
graph TD
    INIT["init / classify / decomp"]
    ACYCLIC["acyclic<br/>break cycles"]
    RANK["rank — network simplex<br/>(ns · ns-core · ns-range · ns-subtree)"]
    MINCROSS["mincross<br/>(build · order · cross · flat)<br/>reduce edge crossings"]
    POSITION["position<br/>assign x-coords (network simplex)"]
    SPLINES["edge routing / splines<br/>(edge-route-* · flat · ortho-adapter)"]

    INIT --> ACYCLIC --> RANK --> MINCROSS --> POSITION --> SPLINES
    style RANK fill:#e8f0e8
    style MINCROSS fill:#e8f0e8
    style POSITION fill:#e8f0e8
```

## graphviz (C — spec, for reference)

The C module layout each TS module is ported from:

```mermaid
graph TD
    CCDT["lib/cdt"] --> CCGRAPH["lib/cgraph"]
    CCGRAPH --> CCOMMON["lib/common + lib/label"]
    CCOMMON --> CDOTGEN["lib/dotgen (dot)"]
    CCOMMON --> CNEATO["lib/neatogen / circogen / osage / sfdpgen"]
    CDOTGEN --> CGVC["lib/gvc (context + plugins)"]
    CNEATO --> CGVC
    CPATH["lib/pathplan"] --> CDOTGEN
```
