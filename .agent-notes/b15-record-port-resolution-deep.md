<!-- SPDX-License-Identifier: EPL-2.0 -->
# b15 residual: record-port attachment resolution (T2/T8, fix-attr-or-tag-bucket)

## Status: DEEP per D3 — disposition, not fixed. Tracked gap.

After the gvQsort routing-order fix, graphs-b15 is down to **4 differing
edge groups** (was 5 + fake-order noise): FlightToHover:Target->HoverRest:In
(Δ132), FPMCenter:Always->FPMStand:In (7 vs 10 pts),
FPMHoverCenter:Always->FPMHover:In (7 vs 10 pts),
HoverStrafeToStop:Normal->HoverToFlight:In (Δ70).

## What is proven

- Node geometry byte-conformant (36/36); 144/148 edge groups
  byte-identical. The stale "1pt x-coord amplified" note
  (b69-concentrate-undermerge) is disproven — that class no longer
  exists post the 2026-07-02 fixes.
- Divergence origin is the **resolved tail-port (p, side) at beginpath**
  for 3 of the 4 (instrumented both sides, same node coords):
  - FPMCenter: C `(-77.09, 0) side=LEFT` vs port `(-39.14,-18) side=1`
  - FPMHoverCenter: C `(-78.64, 0) side=LEFT` vs port `(-39.14,-18) side=1`
    — the port's value equals C's resolution of the SAME field toward a
    DIFFERENT head (FPMHoverStep), i.e. the port picks another edge's
    per-edge resolution or another field of the same record.
  - HoverStrafeToStop: C `(-75.15,-18) side=1` vs port `(-125.15, 0)
    side=8` — mismatch in the OPPOSITE direction.
  - FlightToHover matches at beginpath on all 3 chain pieces and
    diverges later (endpath or corridor) — separate sub-question.
- Everything downstream (start point, side boxes incl. C's two-box LEFT
  corridor, box count 8 vs 7, piece counts) follows the port point.
- C's per-edge resolution path: beginpath resolves DYNA ports via
  `resolvePort(n, aghead(fast_e), oldport)` → `closestSide` toward the
  routed segment's head and PERSISTS the result on the edge
  (splines.c:392-393, shapes.c:4322). Same record field legitimately
  resolves to different (p, side) per outgoing edge in C.

## Why deferred (D3)

The mechanism sits in the record-field port resolution × concentrate
chain machinery (which fast edge's port is consulted/copied, when
resolution persists, 1332-adjacent). Each instrumentation hop opened
another layer (port value provenance, per-edge persistence, the
FlightToHover late divergence); pinning it needs a dedicated harness
(dump every tail_port assignment site on both sides). >2-file risk,
regression-prone area.

## Seed for the follow-up mission

Instrument: every write to ED_tail_port/ED_head_port (C) and
`info.tail_port/head_port` (port) with call-site tags, run b15, align
per edge. First question: which side's `FPMCenter:Always` value is the
init-time record-field value and which is a per-edge resolution — then
find who overwrote/failed-to-overwrite. Check port-object aliasing on
chain copies (C copies port STRUCTS by value; TS may share references).
