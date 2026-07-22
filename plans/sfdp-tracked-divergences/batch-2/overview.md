# Batch 2 — B2 edge FP-ties

Depends on Batch 0. Skip if T0.2 marks B2 empty.

Edge-first divergences where the spline geometry differs. Representatives:
- **42** — pinned-position dense graph, bidirectional pairs → `makeMultiSpline`
  (GTS CDT). Divergence traced this session to a CDT incircle tie
  ([[multispline-port-landed]]).
- **241_0** — flat edge, `unfilled_bezier[ptCount] 8 vs 20` → segment-count
  straddle ([[flat-edge-241-is-y-only]], [[long-edge-undersegment-done]]).
- **2521_1** — space-named record ports ([[b15-record-ports-done]]).
- copies/relatives: graphs-size, graphs-unix2/2k, graphs-weight, share/windows-unix2.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T2.1 | Analyze each rep: isolate the tie/straddle to a predicate | debugger | batch-2/findings.md | T0.2 | [x] |
| T2.2 | Fix aggressively (fma/robust predicate) or accept A9 w/ disasm | general-purpose | (src fix, isolated) + batch-2/findings.md | T2.1 | [x] |

Fix-aggressively targets: match the C binary's `fmadd`/`fma` contraction
([[fma-ccw-emulated]], `common/fma.ts`); the robust-incircle predicate
([[prism-overlap-port-done]]); the segment-count `round()` mode
([[root-twopi-maximalbbox-round-mode]]). Accept (class A9) only with `otool
-tvV` disassembly proving the tie is a native fmadd/libm ULP the port cannot
reproduce ([[fma-ccw-emulated]] recipe).
