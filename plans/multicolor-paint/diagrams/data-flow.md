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

# Data flow — multicolor edge (parallel offset curves, M1)

`color="red:blue"` (plain colon) → PARALLEL curves offset by SEP=2 (the
`else if (numc)` branch). The semicolon syntax `red;0.5:blue` is the
separate split-along-length multicolor()/splitBSpline path (optional).

```mermaid
sequenceDiagram
  participant Edge as device.renderEdge (M1)
  participant Parse as multicolor parseSegs (G1)
  participant Off as computeoffset_p/qr (M1)
  participant Job as RenderJob.obj
  participant SVG

  Edge->>Parse: count colors in "red:blue" (numc=1)
  Edge->>Off: build offset spline (SEP=2 perpendicular)
  Edge->>Edge: tmp = pf - numc2*offset  (outermost)
  loop each color (cnum=0 red, 1 blue)
    Edge->>Edge: tmp += offset  (next parallel position)
    Edge->>Job: obj.penColor = color
    Edge->>SVG: <path stroke="color" d=tmp/>
  end
  Edge->>SVG: tail arrow=tailcolor(2nd); head arrow=headcolor(1st=red)
```
