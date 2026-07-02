<!-- SPDX-License-Identifier: EPL-2.0 -->
# NaN 8-edge endpoint residual — mechanism (T2, fix/nan-a2-retire)

## Observation: opposing-pair lane assignment sorted by orig seq, C uses collected order
- **Context**: Re-diagnosing the `graphs/share/windows-NaN` residual (nodes
  0-differing, 8 straight edges shifted 6–14 pt). Per-element title-keyed diff +
  NANDUMP env-gated dumps in C `dotsplines.c` (group members, flags, lane
  installs) mirrored in TS `splines-groups.ts`, diffed line-wise.
- **Finding**: All 8 edges are the members of 4 opposing 2-cycles
  (`Target<->TThread`, `Interp<->InterpF`, `Event<->Target`,
  `AtomProperties<->NRAtom`). The interior control points of each port spline are
  bit-identical to the oracle's — assigned to the OPPOSITE pair member. C's
  `make_regular_edge` assigns lane offsets (edges[0] → interior x −dx,
  dx = Multisep·(cnt−1)/2 = 9; each next edge +Multisep = 18) in the
  edgecmp-sorted collected order, whose within-group tie-break is
  GRAPHTYPEMASK: the MAINGRAPH(64) fast-graph rep — always the FORWARD
  (non-reversed) member, ti=0x51 — sorts before AUXGRAPH(128) `ND_other`
  entries (the reversed BWDEDGE orig, ti=0xa1). C never re-sorts inside the
  group (`dotsplines.c:419` passes `LIST_AT(&edges, ind)` straight through;
  lanes at `dotsplines.c:1898–1925`). The port's `dispatchEdgeGroup` re-sorts
  the deduped group by ORIGINAL creation seq before lane assignment.
- **Impact**: Whenever a 2-cycle's reversed member was declared first in the
  DOT source (smaller seq), the port promotes it to lane 0 — each edge draws on
  the other's corridor; endpoints/clips shift by up to Multisep=18 (6–14 pt
  after angled boundary clipping). Exactly the 4 divergent NaN pairs; the 5th
  corpus 2-cycle `Target<->TargetF` (forward seq < reversed seq) is unaffected —
  4/4 + 1/1 consistency.
- **Confidence**: High (C+TS dumps line-wise; forced-order experiment).

## Mechanism artifact (T3/T5 contract)

```json
{
  "cause": "dispatchEdgeGroup re-sorts the deduped parallel group by original creation seq before lane assignment; C assigns lanes in the edgecmp collected order, where GRAPHTYPEMASK puts the MAINGRAPH forward rep first and the AUXGRAPH reversed member second regardless of seq.",
  "origin": "src/layout/dot/splines-groups.ts:121",
  "causalChain": "For opposing 2-cycles whose reversed member has the smaller orig seq, the sort gives it lane 0 (interior x -9) and the forward edge lane +9 — each edge is drawn on the other's Multisep=18 corridor, so after node-boundary clipping at an angle the endpoints shift 6-14 pt. The 4 divergent NaN pairs are exactly the 2-cycles with reversed-first seq; Target<->TargetF (forward-first) matches, as observed.",
  "ruledOut": [
    "(a) boundary clip-point drift from approach angle — interior control points are bit-identical between port and oracle, merely assigned to the opposite member; clipping is faithful (per-element diff + lane dumps)",
    "(b) residual port metric — all 76 node reference points match exactly and the group base path is identical on both sides",
    "(c) compress x-simplex tie — nodes exact; both sides produce the same two lanes (base ±9), so upstream x-coordinates are identical",
    "collection/edgecmp order defect — TS collected order matches C line-wise on all 5 cnt=2 groups (same entries, same ti flags 0x51/0xa1)"
  ],
  "fixLocus": ["src/layout/dot/splines-groups.ts"],
  "classification": "port-defect"
}
```

## Forced-order confirmation experiment
Temporarily skipping the `uniq.sort(origSeq)` (env `NANFORCE`, reverted) and
re-rendering all three corpus copies: per-element diff vs oracle →
**nodes-differing=0, edges-differing=0 on graphs/, share/, windows/**; residual
SVG diff is emitter comments/header only. C tree reverted, plugin rebuilt,
oracle byte-verified against the pre-instrumentation SVG.

## Note for T3
- `routeCurvedGroup` (splines-groups.ts:136) carries the same origSeq sort for
  `splines=curved` groups — same suspect pattern, but curved routing centres
  perp-offsets differently; assess against C `routespl.c` before touching.
- The b15-era comment on the sort ("matching C's allocation order e1<e2<e3")
  is true only for same-direction parallels, where collected order ≈ orig-seq
  order anyway; it is wrong for opposing pairs. Dropping the sort preserves
  both cases because the port's collected order is already C-faithful (dumped).
