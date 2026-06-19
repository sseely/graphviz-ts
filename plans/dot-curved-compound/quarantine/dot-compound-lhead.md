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

## Why not fixed here (C-instrumented findings, 2026-06-19)

An attempt re-stashed the arrow polygon at the cluster-clipped tip and reused the
existing `edge-route-clip.ts:arrowEndClip(pts, tip, elen)` to back the path off.
Result: **the arrow polygon matched native C byte-for-byte**, but the spline path
diverged. Instrumenting C's `makeCompoundEdge`/`arrowEndClip` for this fixture
showed (layout coords):

- elen (`arrow_length`) = **11.5135**, ports `(0,0)`.
- cluster-clipped segment into `arrowEndClip`: `[(43,92.004) … (43,76.499)]`.
- C output path: `[(43,84.5),(43,82.5),(43,80.5),(43,78.5)]`, `ep=(43,76.499)`.

C's `arrowEndClip` (`arrows.c:285`) does NOT shorten by a straight `elen`: it sets
`ep = ps[endp+3]`, optionally backs up a whole segment when the last one is
shorter than `elen` (`endp -= 3`), then runs `bezier_clip` — a recursive de
Casteljau subdivision — against a sphere of radius `elen` about the tip. The
resulting control points (`84.5/82.5/80.5/78.5`) are subdivision outputs, not a
linear backoff, and the reused 4-point wrapper produces a different (collapsing)
result on this short, fully-inside-sphere segment.

Full parity therefore needs a faithful port of the **index-form**
`arrowEndClip(e, ps, startp, endp, spl, eflag)` driven by C's `bezier_clip`
subdivision (the existing pure 4-point wrapper is insufficient), plus the
`ep`/`eflag` bookkeeping. This is a real T38-completion sub-task beyond the curved
mission's ADR-2 "verify, fix on divergence" scope. Reverted the attempt; kept the
wiring fix (path clips to the cluster boundary, the faithful path portion).

## Re-promotion

Port C's index-form `arrowEndClip` + `bezier_clip` into the compound head/tail
clip (set `bez.ep`/`eflag`, re-stash `_arrowPts`/`_tailArrowPts`), then re-add
this entry to `manifest.json` and bump the suite count. The C ref is minted and
ready; the arrow polygon is already known to match once the path math is faithful.
