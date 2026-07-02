<!-- SPDX-License-Identifier: EPL-2.0 -->
# b15 port provenance (T1+T2, fix-b15-record-ports)

## Verdict: H3 — resolvePort target, in routeBackEdge (H1, H2 disproven)

```json
{
  "mechanism": {
    "cause": "routeBackEdge routed the whole-edge makeFwdEdge view (head = far real endpoint) through beginSeg/endSeg, so beginpath's per-edge dyna resolution (resolvePort → closestSide) aimed at the far endpoint. C's make_regular_edge routes the collected FAST SEGMENT view: beginpath's edge head is the adjacent chain vnode.",
    "origin": "src/layout/dot/edge-route-chain.ts:routeBackEdge (routeChainSegmented(g, fwdEdge, fwdEdge, segs)); C ref lib/dotgen/dotsplines.c:make_regular_edge segfirst/tn/hn walk",
    "causalChain": "b15's 4 residual edges are REVERSED record-port edges (fast chain runs head→tail). Port resolved FPMStand's In field toward FPMCenter@(3235,164) → compass 's' → attachment (-39.14,-18); C resolved toward the adjacent vnode V@(3136,310) → compass 'w' → (-77.09,0)/side LEFT. Different attachment → different side boxes, corridors, piece counts (7 vs 10), Δ70-132. FlightToHover:Target (T2) shared the root via the same whole-edge view at the opposite end.",
    "ruledOut": [
      "H1 sameport eligibility: ZERO sameport writes for the affected edges in the port-write trace (490 PW lines)",
      "H2 reference-sharing: all port objects distinct (WeakMap identity ids); the identical (-39.14,-18) across FPM* nodes was coincidental — both nodes' In fields share the same field-center offset",
      "field geometry: init-time port values byte-match C (In=(-39.14,0) side=13, Always=(50.42,0) side=7); node paths byte-identical",
      "closestSide math: identical compass results wherever inputs matched (FPMRotate→s, Stand→w both sides)"
    ]
  },
  "fix": "routeChainSegmented(g, segs[0], segs[segs.length-1], segs) — segments carry correctly-oriented copied ports; fwdEdge kept as clip target (1644 forward-clip direction). Result: b15 100% byte-identical to oracle (189/189 groups)."
}
```

GOTCHA for future port-lifecycle work: beginpath/endpath PERSIST the
per-edge resolution onto the routed fast edge's port (both sides) — a
port dumped later shows dyna=0/constrained=1 even though it began as a
dyna field port; trace WRITES, not states.
