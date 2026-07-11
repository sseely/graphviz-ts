# twopi `states` family RCA — FIXED (verdict (b): FMA fp-contract in polylineMidpoint)

Ids: `graphs-states`, `share-states`, `windows-states` (twopi). 77 diffs each,
firstDiff `edge:empty->full#0 _draw_ ... 46.66 vs 42.14` (a ~4.5pt whole-canvas
x-shift that is a *downstream consequence* of the real bug, not the bug itself).

## Verdict: (b) fixable op-order — NOT (a) upstream drift

The prior journal entry (2026-07-11 "states family: addXLabels object ORDER
fixed") pinned the residual to a 1-ULP anchor difference and attributed it,
tentatively, to the "dotneato_closest Bezier-eval chain". That attribution was
**wrong on two counts**, corrected here by bit-level A/B against the native
oracle:

1. These edges are **EDGETYPE_LINE**, so `edgeMidpoint` takes the
   `polylineMidpoint` branch, *not* `dotneato_closest`.
   - C constants are `<<1`-shifted (`EDGETYPE_LINE = 1<<1 = 2`,
     `EDGE_TYPE(g) = GD_flags & (7<<1)`; const.h:235, macros.h:25). The port's
     constants are un-shifted (`EDGETYPE_LINE = 1`). So C's dumped `et=2` and the
     port's `et=1` are **the same type** — both LINE, both `polylineMidpoint`.
2. The 1 ULP is **inside `polylineMidpoint`'s interpolation arithmetic**, and it
   is an **FMA (`-ffp-contract`) contraction**, not spline drift.

## Controlled experiment (bit-level A/B)

Instrumented both `edgeMidpoint` sites at `%.20g` (port env `CLOSEST_DUMP`,
native env `STATES_DUMP` in a rebuilt oracle; both probes since reverted).

- **Spline control points feeding `polylineMidpoint` are BIT-IDENTICAL**
  C vs port for all five edges → rules out (a) upstream layout/PRISM drift.
- The dispatch edge (`empty->stolen`) anchor x differed by exactly 1 ULP:
  - C  `polylineMidpoint` → `42.143375056858062067`
  - port `polylineMidpoint` → `42.143375056858054961`  (plain IEEE)
- C compiles `mf.x = (qf.x*dist + pf.x*(d-dist)) / d` (splines.c:1271) under
  `-ffp-contract`, fusing the **first** product `qf.x*dist` into an fmadd:
  `fma(qf.x, dist, pf.x*(d-dist)) / d`. Emulating that fma reproduces the C
  value bit-exactly. Verified across **all five** edges:

  | edge            | plain (2-round)        | fma(qf,dist,pf·(d−dist)) | C oracle               |
  |-----------------|------------------------|--------------------------|------------------------|
  | empty->stolen   | ...054961 (≠C)         | ...062067                | ...062067              |
  | empty->full     | ...047856              | ...047856                | ...047856              |
  | stolen->waiting | ...062067              | ...062067                | ...062067              |
  | stolen->full    | ...047856 (≠C)         | ...054961                | ...054961              |
  | waiting->full   | ...054961              | ...054961                | ...054961              |

  Plain matched 3/5; fma matched **5/5**. The two `≠C` edges are exactly the
  ones whose fma/plain rounding diverges — and the dispatch edge's 1-ULP anchor
  x is what tips the xlabel side-selection knife-edge
  (`fl((anchor−sz)+sz) < anchor` accept/reject), flipping "dispatch" from the
  left of its vertical edge to the right, changing the pre-translate bbox width
  and thus offsetting the whole canvas by ~4.5pt.

## Fix

`src/common/spline-midpoint.ts:polylineMidpoint` — the returning interpolation
now uses the port's existing faithful `fma` (common/fma.ts):

```ts
x: fma(qf.x, total, pf.x * (d - total)) / d,
y: fma(qf.y, total, pf.y * (d - total)) / d,
```

Same A8 fp-contract class as the 2026-07-11 shapes-family poly-sizing fix.

## Verification

- `graphs-states`, `share-states`, `windows-states` (twopi): **pass, 0 diffs**
  (compareXdot @ 0.01).
- tsc clean; npm test green.
- Corpus sweeps: see decision-journal row.

## Blast radius: the b29/2343 A9 knife-edge family RESHUFFLES (net +3 conformant)

Fresh twopi sweep vs committed baseline (730 pass / 21 div):
**735 pass / 16 div**. Verdict deltas:

- FIXED: graphs-states, share-states, windows-states (this fix);
  144_no_ortho (cherry-picked shiftEdgePoints fix, baseline predates it);
  **2343, share-b29, windows-b29** — all three were *accepted A9 divergences*
  (registry `accepted-divergences-engines.json` twopi) and now **pass**.
- FLIPPED OUT: **graphs-b29, linux.i386-b29** pass→diverged, each with the
  identical single-diff signature the accepted b29 entries had
  (`edge:Node14732->Node14731#0 _ldraw_ text[1]: 368.1 vs 356.1`).

Controlled A/B on graphs-b29 (probes on both sides at %.20g, since reverted):

- b29 control points feeding `polylineMidpoint` are **NOT bit-identical**
  (pts[0].y, pts[1].x differ 1 ULP) — upstream twopi drift EXISTS on b29
  (unlike states, where control points are bit-identical).
- With the fma fix the port's midpoint anchor is **bit-identical to C**
  `(452.05818545365673344, 365.10461184454925387)` — yet the label STILL
  flips side. With the plain form the anchor is 1 ULP off C in both x,y —
  yet the label lands on C's side.
- Conclusion: the b29 side-selection knife-edge is **not** decided by the
  midpoint arithmetic; it is a placeLabels tie decided by the *other*
  (1-ULP-drifted) objects in the label grid. Honest arithmetic on drifted
  input — exactly the A9 class the registry already assigned to
  share-b29/windows-b29. The faithful-arithmetic fix reshuffles which two of
  the four b29 variants land on the matching side.

### Proposed registry edit (accepted-divergences-engines.json, "twopi")

Remove (now conformant): `"2343"`, `"share-b29"`, `"windows-b29"`.
Add:

```json
"graphs-b29": {
  "class": "A9",
  "bound": "1 draw-op diff; edge label _ldraw_ text[1]: 368.1 vs 356.1 (same knife-edge previously accepted for share-b29/windows-b29; variants swapped when polylineMidpoint gained the faithful fmadd contraction - anchor now bit-identical to C, flip is a placeLabels tie on 1-ULP-drifted surrounding objects)",
  "ref": "known-divergences.md#a9-engine-track-twopi-circo"
},
"linux.i386-b29": {
  "class": "A9",
  "bound": "1 draw-op diff; edge label _ldraw_ text[1]: 368.1 vs 356.1 (identical mechanism to graphs-b29)",
  "ref": "known-divergences.md#a9-engine-track-twopi-circo"
}
```

### known-divergences.md paragraph draft (#a9-engine-track-twopi-circo)

> **b29 family (twopi)** — the four b29 variants share one knife-edge: the
> `EqmtTyp` edge label (Node14732->Node14731) sits on an exact placeLabels
> side-selection tie whose outcome depends on 1-ULP twopi layout drift in the
> surrounding objects. With the faithful fmadd contraction in
> `polylineMidpoint` (states-family fix, 2026-07-11) the port's label anchor
> is bit-identical to the oracle's, yet the tie still resolves oppositely on
> two of the four variants (graphs-b29, linux.i386-b29) while the other two
> (share-b29, windows-b29) now conform — and 2343's accepted A9 label diff
> cleared entirely. Bound: 1 draw-op, Δ12pt label y. Irreducible without
> eliminating the upstream drift (A1/A9 family).

## Ruled out
- (a) upstream spline drift — control points bit-identical.
- dotneato_closest / Bezier eval — not on this edge's code path (LINE type).
- edge-type misport — port `et=1` ≡ C `et=2` (shifted constants), both LINE.
- DIST/arc-length arithmetic — `sqrt(dx²+dy²)` identical both sides; fma on the
  interpolation alone reproduces C on all five edges.

## Known emission gap (NOT surfaced by the bar, left as-is)
C emits `lp="65.471,128.57"` for each xlabel-placed edge label; the port emits
no edge-label `lp`. `compareXdot` does not compare `lp`, so all three ids pass at
0 diffs regardless. Out of scope for closing this family; flagged for a separate
emission pass.
