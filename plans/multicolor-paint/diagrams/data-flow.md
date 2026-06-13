# Data flow — gradient node fill (attrs → SVG)

```mermaid
sequenceDiagram
  participant Res as style-resolve findStopColor (G1)
  participant Code as poly-gencode (G3)
  participant Job as RenderJob.obj
  participant Emit as svg-helpers emitStyle (G2/AD3)
  participant Grad as svg-gradient (G2)
  participant SVG

  Code->>Res: resolveNodeFill({style:filled, fillcolor:"red:blue", gradientangle})
  Res-->>Code: {kind:'linear', fillColor:red, stopColor:blue, frac, angle}
  Code->>Job: obj.fill=Linear; fillColor/stopColor/gradientFrac/gradientAngle
  Code->>Emit: renderer.ellipse(pts, filled=true)
  Emit->>Grad: emitLinearGradient(job, pts, id=l_N)  %% defs inline, AD2
  Grad->>Job: read fillColor/stopColor/frac/angle; getGradientPoints(pts,angle)
  Grad-->>SVG: <defs><linearGradient id="..l_N" x1 y1 x2 y2><stop/><stop/></...>
  Emit-->>SVG: <ellipse fill="url(#..l_N)" stroke=.. />
```

# Data flow — multicolor edge (split along length, M1)

```mermaid
sequenceDiagram
  participant Edge as device.renderEdge (M1)
  participant Parse as multicolor parseSegs (G1)
  participant Split as splitBSpline (M1)
  participant Job as RenderJob.obj
  participant SVG

  Edge->>Parse: parseSegs("red;0.3:blue")
  Parse-->>Edge: [{red,0.3},{blue}]
  loop each spline
    Edge->>Split: split bz at t=0.3 -> bz_l,bz_r
    Edge->>Job: obj.penColor=red
    Edge->>SVG: <path stroke="red" d=bz_l/>
    Edge->>Job: obj.penColor=blue
    Edge->>SVG: <path stroke="blue" d=bz_r/>
  end
  Edge->>SVG: tail arrow fill=red ; head arrow fill=blue
```
