# Component map — gradient fills

```mermaid
graph TD
  ATTR[node/edge/cluster/graph attrs<br/>fillcolor="c1:c2" gradientangle style=radial/striped/wedged]

  RESOLVE[style-resolve.ts<br/>resolveNodeGradient → FillType.Linear/Radial<br/>+ stopColor / gradientAngle / gradientFrac<br/>**T2**]

  GRADMOD[svg-gradient.ts<br/>resetGradientCounters<br/>emitLinearGradientDefs → url(#id)<br/>emitRadialGradientDefs → url(#id)<br/>get_gradient_points<br/>**T1**]

  JOB[RenderJob.obj : ObjState<br/>fillColor / stopColor / gradientAngle<br/>gradientFrac / fill:FillType.Linear|Radial]

  EMIT[svg-helpers.ts<br/>emitStyle extended: FillType.Linear/Radial branch<br/>svgEllipse / svgPolygon / svgBezier<br/>**T2**]

  CLUSTER[svg-cluster.ts<br/>cluster gradient dispatch<br/>**T3**]
  GRAPH[svg-graph.ts<br/>graph bgcolor gradient dispatch<br/>**T3**]

  HTMLFILL[htmltable-emit-fill.ts<br/>withHtmlPaint extended<br/>HtmlPaint.fillGradient<br/>**T4**]

  STRIPED[svg-striped.ts<br/>stripedBox / wedgedEllipse<br/>parseColorSegs<br/>**T5**]

  SVG[SVG output<br/>fill=url(#id) + defs block<br/>OR fill=color striped/wedged segments]

  ATTR --> RESOLVE --> JOB
  RESOLVE --> GRADMOD
  JOB --> EMIT --> GRADMOD
  EMIT --> SVG
  JOB --> CLUSTER --> GRADMOD --> SVG
  JOB --> GRAPH --> GRADMOD --> SVG
  ATTR -->|BGCOLOR GRADIENTANGLE| HTMLFILL --> GRADMOD --> SVG
  ATTR -->|style=striped/wedged| STRIPED --> SVG

  RS[parity-render-styling<br/>ObjState lifecycle wired<br/>DEPENDENCY]:::dep -.->|must land first| JOB
  classDef dep fill:#f9f,stroke:#c33
```
