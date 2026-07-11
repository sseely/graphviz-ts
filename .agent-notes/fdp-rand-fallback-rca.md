# fdp/sfdp overlap dispatch + coincident rand() fallback

Task: eliminate fdp/sfdp iterative-parity **port-error** verdicts by porting the
missing overlap-removal dispatch (55 fdp + 23 sfdp), and the 4 fdp
coincident-node rand() ids.

## Observation: fdp derived-graph overlap mode is the parsed suffix, not the attr
- **Context**: `fdp_xLayout` parses `overlap` ("9:prism" default) into `tries` +
  `rest`; when x_layout leaves overlaps it calls `removeOverlapAs(g, rest)`. The
  old recon ("prism unreachable, x_layout always converges") was wrong — 55
  ccderived graphs reach it.
- **Finding**: mode comes from `rest` ("prism"/"false"/"scale"), passed EXPLICITLY
  to getAdjustMode — not re-read from the graph attr. On the GTS reference build
  `overlap=false` → AM_PRISM value 1000 (adjustMode[1]), not a no-op. Wired
  `removeOverlapAs(g, flag)` in fdp/xlayout.ts onto the ported neato machinery
  (`overlapPrismTries`+`fdpAdjust` for PRISM; `scAdjust` for scale/scalexy/
  compress). normalize runs first (dead on derived graphs); simpleScale stays
  unported per the project decision. Genuinely-unported algorithms (voronoi/
  oscale/vpsc/ortho/ipsep) still throw rather than silently leave overlaps.
- **Impact**: 55 fdp port-errors cleared; many PASS (share-clust3, 2564, 2609,
  2258, nshare-overlap_neato1), rest diverged (normal parity work).
- **Confidence**: High (oracle-compared).

## Observation: sfdp overlap=false → AM_PRISM(1000) runs the in-layout smoother
- **Context**: sfdp_layout: graphAdjustMode default "prism0"; AM_PRISM → in-sfdp
  removal (ctrl.overlap=value), else ctrl.overlap=-1 + post-layout
  removeOverlapWith.
- **Finding**: `overlap=false` → AM_PRISM value 1000 (in-layout OverlapSmoother),
  `overlap=scale` → AM_NSCALE (post-layout scAdjust). Routed the multilevel
  embedding's overlap call through the FULL `removeOverlapPrism` (identical to the
  old scaling-only slice for ntry=0, so prism0 default unchanged) and added a
  post-layout `adjustNodesScale` when doAdjust. Reads overlap_scaling via
  lateDouble (was hardcoded −4).
- **Impact**: 22/23 sfdp port-errors cleared (2258, nshare-overlap_neato1 PASS).
- **Confidence**: High.

## Observation: macOS rand() IS the Park–Miller MINSTD LCG (seed 1)
- **Context**: 4 fdp ids (graphs-b7, graphs-clust5, 2184, 1453) hit the
  coincident-node rand() fallback in tlayout.c doRep/applyAttr and xlayout.c
  doRep. Prior note claimed it "platform-specific and unreachable → throw".
- **Finding**: empirically `rand()` unseeded on this macOS = MINSTD
  (`s=s*16807 mod 2^31-1`, seed 1): 16807, 282475249, 1622650073, … — exactly the
  port's existing `crand()` (common/crand.ts). fdp NEVER calls `srand` (only
  `srand48`, a SEPARATE BSD drand48 stream on macOS where HAVE_SRAND48 is
  defined), so the coincident rand() stream is unseeded ⇒ srand(1), shared in call
  order across tlayout doRep/applyAttr and xlayout doRep. Ported as
  `coincidentDelta()` (re-roll `5 - crand()%10` until non-zero, mirroring C's
  `while` loops); reset `csrand(1)` per render in fdpLayoutEngine.
- **Impact**: all 4 render (no throw); graphs-b7 + graphs-clust5 PASS EXACTLY
  (sequence reproduced), 2184/1453 diverged (accepted — the tail is standard
  iterative FP drift, not the rand path).
- **Confidence**: High (2/4 byte-match the oracle).

## Residual (out of scope): sfdp 2556 armPow overflow
- **Context**: 2556 sets `overlap=false; repulsiveforce=100; K=32`. With the
  dispatch fixed it now reaches the spring embedding, which throws
  `armPow: argument outside the ported normal-finite fast path` (x=NaN, y=101).
- **Finding**: this is a DEGENERATE-OVERFLOW case orthogonal to overlap dispatch —
  the ORACLE also blows up (`bb="0,0,-4.295e+09,-4.295e+09"`, i.e. −2^32). C's
  libm `pow` returns IEEE specials (Inf/NaN) and the layout carries on to emit
  overflowed coords; the port's ARM-pow fast-path guard (src/common/arm-pow.ts,
  out of write-set) throws instead. It would fire under any overlap mode
  (repulsiveforce=100, not overlap, is the trigger); the earlier
  resolveAdjustPrism0 throw merely masked it.
- **Attempted**: a NaN/≤0-safe `repulsivePow` (delegate specials to IEEE pow)
  stops the throw but then the ntry=1000 OverlapSmoother HANGS on the NaN layout
  (C exits fast because its overflow is finite-huge → no overlaps → early break;
  the port's NaN defeats the maxOverlap≤1 break). Reverted — it trades a fast
  port-error for a 90s timeout without achieving a clean render, and is
  embedding surgery beyond the overlap-dispatch mandate.
- **Decision**: leave 2556 as a fast armPow port-error, documented here. Proper
  fix = make the ARM-pow port total for IEEE specials (own mission, arm-pow.ts) so
  the degenerate layout overflows faithfully like C.
- **Confidence**: High (root cause isolated: oracle overflow + probe x=NaN).
