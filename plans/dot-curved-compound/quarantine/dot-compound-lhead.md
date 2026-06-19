# Quarantine: `dot-compound-lhead` — compound=true lhead/ltail clipping

**Fixture:** `test/golden/inputs/dot-compound-lhead.dot`
(`compound=true; subgraph clusterA{a} subgraph clusterB{b};
a -> b [lhead=clusterB, ltail=clusterA]`)
**Native-C ref:** `test/golden/refs/dot-compound-lhead.svg`
**Status:** quarantined (removed from `manifest.json`); fixture + ref retained.

## What was fixed (kept on the branch)

Compound clipping was **never wired** before this mission:

- `g.info.compound` was never assigned, so `dotCompoundEdges` (gated on it at
  `dot/index.ts`) never ran.
- `e.info.lhead`/`e.info.ltail` were never populated from edge attributes, so
  even when run, `resolveClusterPair` found no clusters.

Faithful fix (mirrors C):
- `dot/index.ts`: gate the call on `mapbool(g.attrs.get('compound'))`
  (`lib/dotgen/dotinit.c:338`), and `dotCompoundEdges` no longer self-gates
  (C's `dot_compoundEdges` has no internal gate).
- `compound.ts:resolveClusterPair`: read `lhead`/`ltail` from `e.attrs`
  (C's `agget`, `compound.c:274-275`), with an `e.info` fallback for unit tests.

With this, the spline **path** now clips correctly to the cluster boundary —
the start point matches C exactly:

| element | port | native C |
|---------|------|----------|
| path start | `M43,-92.5` (clusterA bottom) ✅ | `M43,-92.5` |
| path end   | `…43,-84.5` | `…43,-86.5` |
| arrowhead tip y | `-53.98` (unclipped, at node) ❌ | `-86.01` (at clip) |

## Remaining divergence + root cause

The **arrowhead** does not follow the clip: it stays at the original node-
boundary position (`-53.98`) instead of moving to the clipped head end (`-86`).

C's `makeCompoundEdge` (`compound.c:336-352`) handles the arrow during the head
clip:

```
if (bez->eflag)
    endi = arrowEndClip(e, bez->list, starti, endi, &nbez, bez->eflag);
```

`arrowEndClip` (`lib/common/arrows.c`) clips the spline to the arrowhead base and
records the tip in the new bezier's `ep`/`eflag`, which the renderer then draws.
The TS `compound.ts:clipHeadNormal` trims the control points (`splineIntersectf`
/ `boxIntersectf` are ported) but does **not** call `arrowEndClip` nor update
`bez.ep`/`eflag` — so the renderer draws the arrow from the pre-clip endpoint.

## Why not fixed here

Full parity needs porting `arrows.c:arrowEndClip` (the `(e, list, starti, endi,
nbez, eflag)` form — distinct from the already-ported
`edge-route-clip.ts:arrowEndClip(pts, tip, elen)`) plus the `ep`/`eflag` →
renderer interaction. That is a substantial T38-completion sub-task beyond the
curved mission's "verify, fix on divergence" (ADR-2) scope. The wiring fix is
kept as faithful partial progress (path clips correctly).

## Re-promotion

When compound arrow clipping lands (arrowEndClip + `ep`/`eflag` in
`clipHeadNormal`), re-add this entry to `manifest.json` and bump the suite
count. The C ref is minted and ready.
