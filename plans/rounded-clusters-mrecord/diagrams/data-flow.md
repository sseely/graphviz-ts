<!-- SPDX-License-Identifier: EPL-2.0 -->
# Data flow — rounded boundary dispatch

C draws every special-corner boundary through one `round_corners`; the port
gains a shared helper that the cluster and record sites call, mirroring it.

```mermaid
flowchart TD
  subgraph C[C graphviz spec]
    cg[poly_gencode] --> rc[round_corners job AF sides style filled]
    rg[record_gencode\nMrecord -> style.rounded] --> rc
    ec[emit_clusters\nstyle.rounded] --> rc
  end
  subgraph TS[port after T1]
    poly[poly-gencode\ndrawRoundCorners] --> H[roundedBoxPath helper\npoly-shapes.ts AD-1]
    clu[device.ts renderOneCluster\nstyle.rounded? AD-2] --> H
    rec[record.ts recordGencode\nMrecord/SPECIAL_CORNERS? AD-3] --> H
    H --> bez[renderer.bezier -> SVG path]
  end
```

```mermaid
flowchart LR
  bb[node/cluster bb\nUNCHANGED AD-4] --> corners[4 corner points]
  corners --> dispatch{style has\nrounded / special?}
  dispatch -- no --> poly[renderer.polygon\n-> sharp path/polygon]
  dispatch -- yes --> helper[roundedBoxPath\ninterpolationPoints + bezier]
  helper --> path[fill + stroke rounded path]
```
