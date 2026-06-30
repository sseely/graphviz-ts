<!-- SPDX-License-Identifier: EPL-2.0 -->

# Data flow — rounded bgcolor fill emit

```mermaid
sequenceDiagram
    participant E as emitHtmlLabel / emitCellDecoration
    participant B as emitBgFill (htmltable-emit.ts)
    participant P as withHtmlPaint (htmltable-emit-fill.ts)
    participant RB as emitRoundedBezier (poly-shapes.ts)
    participant R as renderer (SVG)

    E->>B: BgFillCtx { bgcolor, box, pos, border, style, gradientangle }
    Note over B: parseGradientSpec → solid | gradient paint
    B->>P: withHtmlPaint(paint incl. penWidth=border)
    Note over P: set obj fill/stop/gradientAngle + penWidth (gap B)
    alt style includes "rounded"  (gap A)
        B->>RB: emitRoundedBezier(mkPts(box,border,pos), {0,0}, true, {renderer,job})
        RB->>R: beziercurve(...) → <path fill="url(#l_N)" stroke-width=N/>
        Note over R: gradient bbox derived from the rounded path points
    else not rounded (unchanged)
        B->>R: polygon(pts, filled) → <polygon fill=… stroke-width=N/>
    end
```

The gradient machinery is unchanged; only which primitive carries the fill
(`<path>` vs `<polygon>`) and the `stroke-width` attribute change. The renderer
derives the gradient `x1/x2/y1/y2` from whichever shape it is given — proven
conformant for the rounded case by `grdcluster` (a rounded gradient cluster
control).
