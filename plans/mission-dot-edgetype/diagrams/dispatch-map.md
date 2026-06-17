# Edge-type dispatch map

```mermaid
flowchart TD
  A[routeOneEdge / routeForwardEdge] --> ET{edgeType g}
  ET -->|EDGETYPE_NONE| SKIP[skip routing — already wired]
  ET -->|other| MR{multi-rank LINE?}
  MR -->|yes, delr>1| ML[makeLineEdge — T3\n4-pt or 7-pt direct segment]
  ML -->|declines delr==1| BOX
  MR -->|no| BOX[box corridor: beginPath..completeRegularPath]
  BOX --> RT["routeRegularByType P, et — T1/T2"]
  RT -->|SPLINE default| RS[routeSplines — unchanged]
  RT -->|PLINE| RP[routePolylines]
  RT -->|LINE, pn>4| RPL[routePolylines + straighten to 4]
  RS --> INSTALL[clipAndInstall]
  RP --> INSTALL
  RPL --> INSTALL
  ML --> INSTALL
```

Emit points wired in T2: `edge-route-faithful.ts:332`,
`edge-route-chain.ts:137`, `edge-route-chain.ts:268`.
C spec: `dotsplines.c:make_regular_edge` (1757-1861), `makeLineEdge` (1636).
