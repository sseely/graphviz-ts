<!-- SPDX-License-Identifier: EPL-2.0 -->
# Data flow — where the residual can arise

The 8 affected edges are straight, rank-adjacent-or-short, under
`ratio=compress` + `orientation=landscape` + `size=`. Node inputs are exact;
the endpoint shift must enter between port resolution and the installed
spline endpoints.

```mermaid
sequenceDiagram
    participant XNS as x-coord NS (compress)
    participant PORT as port resolution (tail/head)
    participant MRE as make_regular_edge walk
    participant BOX as maximal_bbox / pathend boxes
    participant RS as routesplines
    participant CLIP as clip_and_install (shape clip)
    participant SVG as emit

    XNS->>PORT: node coords (MATCH C: 76/76)
    PORT->>MRE: tail/head port points (candidate b)
    MRE->>BOX: begin/endpath boxes (candidate a input)
    BOX->>RS: corridor
    RS->>CLIP: raw control points
    CLIP->>SVG: clipped endpoints (OBSERVED Δ 6-14pt, candidate a)
    Note over XNS: candidate c: compress<br/>x-simplex tie inside<br/>routing aux pass only
```

T2's dumps bracket each arrow for the 4 edge pairs; the first differing value
names the candidate.
