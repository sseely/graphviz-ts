# T6 — Spline attachment: design

Design for wiring the resolved ports (T1–T5) into the **rendered** spline.
Supersedes the original T6-spline-attach.md approach, which assumed the
wrong render path. Written after architecture recon (2026-06-13).

## 1. Problem & root finding

Ports are fully resolved (`e.info.tail_port` / `head_port` carry `p`,
`side`, `clip`, `theta`, `dyna`, `defined`) but never reach the SVG:
`A:s -> B:n` renders identical to the no-port baseline.

**There are two spline routers in the port:**

| Router | Files | Ports? | Status |
|--------|-------|--------|--------|
| **Active** `routeOneEdge` | `edge-route.ts` → `edge-route-routing.ts` (`buildRankCorridor`, `routeWithRank`, `clipToNodes`) → `edge-route-poly.ts` (`computeSpline`) | **No** | drives all 115 goldens |
| **Faithful** `beginPath`/`endPath` | `splines-path-begin.ts` / `-end.ts` (full C `beginpath`/`endpath`: port point, side-mask boxes, dyna, clip) | **Yes** | **ported but UNUSED** |

`dotSplines` (splines.ts) explicitly *defers* the routesplines/boxes path
and calls the simplified active router instead; `beginPath`/`endPath` were
ported in anticipation but never wired in.

**Decisive compatibility fact:** both produce/consume `Box[]`.
`computeSpline(boxes: Box[], …)` and `beginPath`'s `endp.boxes: Box[]` are
the same representation — so the faithful box logic can feed the active
fitter.

## 2. What C `beginpath` does (the spec, splines.c:378)

For the tail end of a regular edge:
1. if `tail_port.dyna` → `resolvePort` (T5, done).
2. `P.start.p = ND_coord(n) + tail_port.p`  ← **port point**.
3. if `tail_port.constrained` → `P.start.theta = tail_port.theta`.
4. if `side = tail_port.side` set: build **side-mask routing boxes**
   (TOP → 2 boxes steering up-and-around-left/right; BOTTOM/LEFT/RIGHT →
   1 box), nudge `start.p` by ±1, and **`tail_port.clip = false`**.
5. else (no side): default box = node box.

`endpath` is the mirror for the head end. `clip_and_install` then clips
the spline to each node boundary **unless `port.clip` is false**.

The side-mask box arithmetic is already faithfully ported as
`BeginRegSide` / `BeginFlatSide` in `splines-path-begin.ts` (and the
End equivalents) — **reuse, don't re-port.**

## 3. Design decision

**Extend the active router with port handling; reuse the ported box
arithmetic.** Rejected alternatives:
- *Switch the active router to `beginPath`/`endPath`+routesplines.* Too
  big — risks all 115 no-port goldens (different fitter), and the full
  routesplines path is itself "deferred/incomplete" per splines.ts.
- *Re-port the side-mask boxes into edge-route-boxes.ts.* Duplicates the
  already-correct `BeginRegSide` logic.

### Three effects to wire, in priority order

1. **Port point** (dominant): `startPt = tail.coord + tail_port.p`,
   `endPt = head.coord + head_port.p`. This alone fixes the common cases —
   record-field ports (`A:f0`, the point is offset left/right) and
   compass ports aligned with the edge (`A:s -> B:n` vertical,
   `A:e -> B:w` LR). For aligned compass ports the port point ≈ the
   default boundary clip, so the delta is sub-pixel (probe: M27,-72 vs
   -71.7 — within AD6's 0.5pt).
2. **Clip skip**: when `port.clip === false` (every compass/side port),
   do NOT clip that end to the node boundary — the port point is exact.
   Without this, `clipToNodes` overwrites the port point.
3. **Side-mask boxes** (steering): when `port.side` is set, replace the
   corridor's tail/head box with the `BeginRegSide`/`EndRegSide` boxes so
   the spline exits the correct face. Needed only when the port
   contradicts the natural edge direction (`A:n -> B` with B *below* A →
   exit top and loop) or steers sideways. Aligned ports don't need it.

## 4. Concrete changes (write-set: edge-route.ts, edge-route-routing.ts,
   edge-route-boxes.ts + tests)

Thread an optional bundle (keeps every fn ≤5 params):

```ts
interface PortRoute {        // null fields → that end is a plain node clip
  tailP: Point | null;       // tail.coord + tail_port.p, else null
  headP: Point | null;       // head.coord + head_port.p, else null
  clipTail: boolean;         // tail_port.clip
  clipHead: boolean;         // head_port.clip
  tailSide: number;          // tail_port.side (0 = none)
  headSide: number;          // head_port.side
}
```

- **`routeOneEdge`** (edge-route.ts): after `nodeBoxOf`, resolve dyna
  (`resolvePort`) and build `PortRoute` from `e.info.tail_port/head_port`.
  If both ports are default (no side, p zero, clip true) pass `undefined`
  → existing path unchanged (**byte-stability gate**). Pass `PortRoute`
  into `straightEdgeSplineWithRank`.
- **`straightEdgeSplineWithRank` / `routeWithRank`**: forward `PortRoute`
  to `buildRankCorridor` and `clipToNodes`.
- **`buildRankCorridor`**: `startPt = tailP ?? {tail center, y-1}`,
  `endPt = headP ?? {head center, y+1}`. When `tailSide` set, replace
  `makeTailBox(...)` with the side-mask boxes (port the `BeginRegSide`
  arithmetic into edge-route-boxes.ts as `tailPortBoxes(side, nb, coord,
  ranksep, startP)` returning `Box[]`); same for head via `EndRegSide`.
- **`clipToNodes`**: bundle params into `{penwidth, clipTail, clipHead}`
  (replaces the positional `penwidth`; update both call sites). Skip
  `bezierClipNode` for an end when its clip flag is false.

The multi-rank / back / flat / non-forward paths get the same
`PortRoute` threading in a second pass; most port-using inputs are simple
regular edges, so the simple path lands the bulk of the value first.

## 5. Phasing

- **T6a** — port point + clip skip + dyna (no side boxes). Verify against
  the oracle: `A:s->B:n`, `rankdir=LR A:e->B:w`, record `A:f0->B`. Expect
  pass within 0.5pt for aligned compass + record fields.
- **T6b** — side-mask boxes (`tailPortBoxes`/`headPortBoxes` from the
  `BeginRegSide`/`EndRegSide` port). Covers steering/contradictory ports.

## 6. Byte-stability & tolerance

- No-port edges: `PortRoute === undefined` → zero change. 115 goldens
  byte-identical (hard gate, every task).
- Port goldens (T8): tolerance class **0.5pt** (AD6).
- **Known risk (journal, don't chase):** the active fitter
  (`computeSpline` = shortestPath + pathplan) is NOT C's `routesplines`.
  For hard steering ports the fitted spline may exceed 0.5pt even with
  correct boxes — a *fitting-algorithm* divergence, not a port bug (same
  class as the wedged libm case). T8 mints goldens for the cases that
  reproduce within tolerance and journals/excludes the rest with a
  comparison page (per the CLAUDE.md excluded-case rule).

## 7. Validation already done

- Port resolution (T1–T5) verified vs C: compass p/theta/side/clip,
  record field bbox, dyna closestSide.
- Probe confirms the gap is purely the render-path wiring (ported edge ==
  no-port baseline today; C differs by the port point).
- Box representations confirmed compatible (`Box[]` both sides).
