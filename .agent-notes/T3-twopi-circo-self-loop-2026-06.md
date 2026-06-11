## Observation: twopi/circo self-loop — nodesep default and BB expansion

- **Context**: T3 task — debug twopi/circo self-loop divergence from quarantine goldens
- **Finding**:
  1. **Bug 1 (fixed)**: `src/layout/neato/splines.ts` lines 304 and 319 used `g.info.nodesep ?? 16`. Should be `?? 18`. C spec: `lib/common/input.c:667` — `GD_nodesep(g) = POINTS(DEFAULT_NODESEP) = POINTS(0.25) = 18`. Only `dot/init.ts` sets `g.info.nodesep=18`; fdp, twopi, circo do not set it before spline routing. Fix applied.
  2. **Bug 2 (stop condition)**: twopi bounding box doesn't include self-loop spline extent. C's `clip_and_install` (`splines.c:312`) calls `update_bb_bz(&GD_bb(g), cp)` for each installed bezier, expanding GD_bb. Port's `clipAndInstall` always passes `bb=null` to `copyToBezier`. `normalizeGraphBB` (called in `twopi/index.ts`) then overwrites `g.info.bb` with node-only `computeSubgraphBB` result. Fix requires either: (a) propagate `g.info.bb` through `clipAndInstall`, or (b) post-normalization expansion in `twopi/index.ts`. Both outside T3 write-set.
- **Impact**: circo-self-loop now PASSES (maxDelta=0). twopi-self-loop FAILS on viewBox/dimensions (maxDelta=18, spline coords are now correct). fdp-tiny-self-loop port-pin stale (was pinned with 16-pt stepx; T5 must regenerate refs-port/).
- **Confidence**: High (C oracle confirmed: GD_nodesep=18, GD_bb.UR.x=72 after layout)
