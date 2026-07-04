## Observation: graphs-shells diverged = mincross flat-rank within-order swap, NOT edge spline

- **Context**: Root-causing graphs-shells (parity.json: diverged, maxDelta 264,
  firstDiffPath svg/g[1]/g[27]/path[1]/@d — an edge spline).
- **Finding**: The edge-spline diff is DOWNSTREAM. All node y-coords (ranks)
  match the oracle exactly. The entire divergence is within-rank horizontal
  ORDERING on three `rank=same` flat groups:
    - rank y=-12 : PORT `POSIX ksh-POSIX`   vs ORACLE `ksh-POSIX POSIX`
    - rank y=-376: PORT `System-V ksh`      vs ORACLE `ksh System-V`
    - rank y=-449: PORT `esh vsh`           vs ORACLE `vsh esh`
  Every other rank's L-R order matches. Node x-positions shift up to ~264px as
  a consequence of the swaps; the g[27] edge spline just follows its endpoints.
- **Subsystem**: dot mincross, flat-group ordering. Port files:
  src/layout/dot/mincross.ts, mincross-order.ts, mincross-flat.ts,
  mincross-cross.ts, mincross-build.ts. C spec: ~/git/graphviz/lib/dotgen/mincross.c.
- **Open**: Not yet pinned whether init order already differs (build_ranks/
  install_in_rank DFS seed) or mincross iteration (medians/transpose/best-
  selection) tie-breaks differently. Crossing-count parity (tie-break vs true
  heuristic miss) not yet measured. No maxphase/MC debug env in port — diagnosis
  needs temporary order-dump instrumentation in both C and port.
- **Impact**: Fix location depends on the above. Likely a tie-break/stability
  divergence (`<` vs `<=`, reverse flag, or best-order capture) given the swaps
  are local to 2-node flat ranks.
- **Confidence**: High (mechanism = flat within-rank order); Medium (exact mincross stage).
