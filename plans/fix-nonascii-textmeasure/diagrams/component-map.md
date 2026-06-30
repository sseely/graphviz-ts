<!-- SPDX-License-Identifier: EPL-2.0 -->
# Component map

```mermaid
graph TD
  GV[non-ASCII .gv label] --> P[parser: charset decode → JS string]
  P --> M{EstimateTextMeasurer.measure}
  M --> E[estimate_text_width_1pt]
  M2[LutTextMeasurer] --> F[freetypeHintedWidth]
  E -->|"BUG: loop per UTF-16 unit"| CW[charWidthUnits ≥128→space]
  F -->|"BUG: loop per UTF-16 unit"| CW
  CW --> W[node width]
  W --> L[dot layout: ranks/x-coords]
  L --> R[edge routing] --> SVG[SVG geometry]

  FIX["FIX: iterate UTF-8 bytes (TextEncoder)"] -.replaces loops in.-> E
  FIX -.replaces loops in.-> F

  classDef bug fill:#fdd,stroke:#900;
  classDef fix fill:#dfd,stroke:#090;
  class E,F bug;
  class FIX fix;
```

C spec: `lib/common/textspan_lut.c:estimate_text_width_1pt` loops per byte
(`(unsigned char)*c`); `estimate_character_width_canonical` maps byte ≥128 →
space. The port must do the same after re-encoding the decoded JS string to UTF-8.
