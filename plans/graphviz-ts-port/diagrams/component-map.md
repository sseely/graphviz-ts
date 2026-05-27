# Component Dependency Map

Arrow direction: A → B means A depends on / imports from B.

```mermaid
graph TD
    subgraph foundation["Foundation"]
        util["src/util\n(agxbuf, LIST, xml, math)"]
        cdt["src/cdt\n(splay, hash, DT_OSET)"]
        rbtree["src/rbtree\n(nil sentinel)"]
        vpsc["src/vpsc\n(VPSC solver)"]
    end

    subgraph model["Graph Model"]
        geom["src/model/geom\n(Point, Box, Bezier)"]
        graph["src/model\n(Graph, Node, Edge,\nGraphInfo, NodeInfo, EdgeInfo)"]
    end

    subgraph parser["Parser"]
        dotparser["src/parser\n(Peggy DOT parser)"]
    end

    subgraph geometry["Geometry Primitives"]
        pathplan["src/pathplan\n(splines, vis-graph)"]
        xdot["src/xdot\n(op parser, coord flip)"]
        sparse["src/sparse\n(CSR/COO, QuadTree)"]
        ortho["src/ortho\n(seed 173, maze)"]
    end

    subgraph common["Common Layer"]
        types["src/common/types\n(shapes, ports)"]
        color["src/common/color"]
        htmllabel["src/common/htmltable"]
        textmeasure["src/common/textmeasure\n(TextMeasurer iface)"]
        arrows["src/common/arrows"]
        splines["src/common/splines"]
        emit["src/common/emit"]
    end

    subgraph gvc["GVC"]
        context["src/gvc/context\n(engine registry)"]
        job["src/gvc/job"]
        device["src/gvc/device"]
    end

    subgraph renderers["Renderers"]
        svgr["src/render/svg"]
        dotr["src/render/dot"]
        jsonr["src/render/json"]
        mapr["src/render/map"]
    end

    subgraph layout["Layout Engines"]
        dot["src/layout/dot\n(Sugiyama)"]
        neato["src/layout/neato\n(stress)"]
        fdp["src/layout/fdp\n(spring)"]
        sfdp["src/layout/sfdp\n(multilevel)"]
        circo["src/layout/circo\n(circular)"]
        twopi["src/layout/twopi\n(radial)"]
        osage["src/layout/osage"]
        patchwork["src/layout/patchwork"]
        pack["src/layout/pack"]
    end

    graph --> geom
    dotparser --> graph

    pathplan --> util
    xdot --> util
    sparse --> util
    ortho --> util
    ortho --> graph

    types --> graph
    color --> util
    htmllabel --> types
    textmeasure --> types
    arrows --> types
    splines --> types
    splines --> pathplan
    emit --> types
    emit --> color
    emit --> htmllabel
    emit --> textmeasure
    emit --> arrows

    context --> graph
    context --> util
    job --> context
    device --> context

    svgr --> device
    dotr --> device
    jsonr --> device
    mapr --> device

    dot --> types
    dot --> cdt
    dot --> pathplan
    dot --> ortho
    dot --> pack
    neato --> pathplan
    neato --> ortho
    neato --> vpsc
    neato --> rbtree
    neato --> types
    fdp --> neato
    fdp --> pack
    sfdp --> sparse
    sfdp --> neato
    sfdp --> pack
    circo --> neato
    circo --> pack
    circo --> cdt
    twopi --> neato
    twopi --> pack
    osage --> neato
    osage --> pack
    patchwork --> fdp
    patchwork --> neato
    patchwork --> pack
    patchwork --> sparse
```
