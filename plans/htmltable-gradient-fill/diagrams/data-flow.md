<!-- SPDX-License-Identifier: EPL-2.0 -->

# Data flow — table bgcolor → gradient emit

```mermaid
sequenceDiagram
    participant E as emit_html_tbl/cell<br/>(htmltable-emit.ts)
    participant BF as emitBgFill
    participant WP as withHtmlPaint<br/>(htmltable-emit-fill.ts)
    participant OBJ as paintObj (ObjState)
    participant R as renderer.polygon
    participant G as svg-gradient.ts

    E->>BF: bgcolor, gradientangle, style
    BF->>BF: parseGradientSpec(bgcolor)
    alt gradient spec "c0:c1"
        BF->>WP: fill=c0, stop=c1, angle, radial
        WP->>OBJ: fill=Linear/Radial,<br/>stopColor, gradientAngle, gradientFrac
    else single color
        BF->>WP: fill=color (solid)
        WP->>OBJ: fill=Solid
    end
    WP->>R: drawFn() → polygon(pts)
    R->>G: obj.fill==Linear/Radial?<br/>emitLinearGradient / emitRadialGradient
    G-->>R: <defs><linearGradient id="l_N">…
    R-->>E: <polygon fill="url(#l_N)">
```

The dashed branch (single color) is today's only path; the gradient branch is
what T1 adds. The renderer + `svg-gradient.ts` side is already correct (proven by
conformant graph/cluster/node gradients).
