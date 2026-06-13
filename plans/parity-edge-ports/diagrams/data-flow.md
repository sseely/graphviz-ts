# Data-flow — port resolution → spline endpoint

```mermaid
sequenceDiagram
    participant P as parser<br/>(dot.pegjs)
    participant B as builder.ts<br/>(T1)
    participant IL as initEdgeLabels<br/>(T2)
    participant CK as chkPort<br/>(T2)
    participant PF as portfn<br/>(poly_port T3 /<br/>record_port T4)
    participant CP as compassPort<br/>(T3)
    participant EI as EdgeInfo<br/>tail_port / head_port
    participant BP as beginpath<br/>(splines-path-begin.ts)
    participant RP as resolvePort<br/>(T5)
    participant CS as closestSide<br/>(T5)
    participant RB as edge-route-boxes<br/>(T6)
    participant SP as spline router<br/>(splines.ts)

    P->>B: NodeId { id, port, compass }
    B->>B: write tailport/headport into edge.attrs
    Note over B: "A:s->B:n" → tailport="s", headport="n"

    B-->>IL: edge with attrs populated

    IL->>CK: chkPort(portfn, tailNode, "s")
    CK->>PF: portfn(tailNode, "s", null)
    PF->>CP: compassPort(n, null, pp, "s", 0, null)
    CP-->>PF: Port { p:{x:0,y:-18}, side:BOTTOM,<br/>theta:π/2, clip:true, dyna:false, defined:true }
    PF-->>CK: Port
    CK-->>IL: Port (name="s" set)
    IL->>EI: e.info.tail_port = Port

    Note over IL,EI: repeat for head_port with "n"

    EI-->>BP: tail_port.p, .dyna, .side, .constrained

    alt port.dyna === true (compass="_")
        BP->>RP: resolvePort(tailNode, headNode, tail_port)
        RP->>CS: closestSide(tailNode, headNode, tail_port)
        CS-->>RP: "n" | "s" | "e" | "w" | null
        RP->>CP: compassPort(n, bp, rv, compassStr, side, null)
        CP-->>RP: Port (resolved)
        RP-->>BP: resolved Port
    end

    BP->>BP: start.p = ND_coord(tail) + tail_port.p
    BP->>RB: side-mask routing boxes (tail_port.side)
    RB-->>SP: []Box for spline corridor

    SP->>SP: route spline through boxes
    SP-->>SVG: M{start.p} C{ctrl1} {ctrl2} {end.p}
```

## Port struct fields set at each stage

| Stage | Fields set |
|-------|-----------|
| T2 `chkPort` | `name` |
| T3 `compassPort` | `p`, `theta`, `side`, `clip`, `dyna`, `defined`, `constrained`, `bp` |
| T4 `record_port` | `bp` (field bbox value copy) → then compassPort fills rest |
| T5 `resolvePort` | re-runs compassPort; `name` preserved |
| T6 `beginpath` | reads `p`, `side`, `constrained`, `theta`, `dyna`, `clip` |
