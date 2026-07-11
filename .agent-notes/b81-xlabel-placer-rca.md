# circo/graphs-b81 — xlabel placer divergence ROOT-CAUSED & FIXED

**Status: FIXED (conformant under circo, 0 diffs, maxΔ 0.00).**
One-line src change: reinterpret the Hilbert R-tree key as signed int32.

## The prior RCA's "103 vs 101" lead was WRONG

Re-instrumented `placeLabels` on the current tip (env-gated `XL_DUMP`, probes
reverted). Both port and native call the placer **132 times** on the same 265
objects (`nObjs=265` both). The RCA's "103 vs 101 invocations" and "order +
membership + anchors diverge" were measurement artifacts. Ground truth:

- Object array membership, order, count: **identical**.
- Every edge-label **anchor**: identical to 4 decimals (all at y=433.315).
- Label **sizes** (`lp->sz`): identical.
- 29 of 132 placements differed **only in the overlap count** `bp.n` at the
  **same** candidate position `bp.pos`. First divergence at placement #11
  (edge object i=23): native `bp.n=0, area=0`; port `bp.n=2, area=15104` — same
  `bp.pos=16046.8745,416.5150`, same obstacle set.

## The primitive (option a — fixable misport)

Split `bp.n` into its two sources (`lblenclosing` loop vs `RTreeSearch`) on both
sides. At #11 both had `nEncl=0`; the divergence was entirely in **`RTreeSearch`**
of the `spdx` R-tree.

- Native `RTreeSearch` returned **NULL** for the query rect `[16047,417,17079,433]`.
- A brute-force scan of native's own `spdx` found **11 objects whose maximal
  boxes overlap** that query — including nodes k=22 (`16577.43,261.35`) and k=62
  (`16038.67,273.23`), **bit-identical** to the two the port found. So native's
  node geometry matches the port; native's R-tree **fails to return overlapping
  leaves that are in the tree**.

Dumping both tree structures: native root had 15 branches, port had 26 —
completely different trees. Native's root branch MBRs left an **x-gap
[15464, 22823]** uncovered, yet leaves with x≈16038–17050 lived under those
branches: **parent MBRs under-cover their children**, so `RTreeSearch` prunes
subtrees holding real overlaps. The port built correct MBRs and found them.

Dumping the R-tree **insertion order** (`xlspdxload` iterates the Hilbert-keyed
bag): the key **multiset was identical**, but the **order differed**. Native
started at key=2868726692; the port started at key=84482 (ascending unsigned).

### Exact cause

`lib/label/xlabels.h:77` declares `HDict_t.key` as **signed `int`**, and
`lib/label/xlabels.c:icompare` compares it as signed. `hd_hil_s_from_xy` returns
**`unsigned int`**; storing it into `int key` reinterprets keys ≥ 2³¹ as
negative, so they sort **before** small positive keys. The bag (`Dtobag`)
therefore feeds `RTreeInsert` in signed-key order → a specific tree shape whose
(buggy, under-covering) MBRs cause `RTreeSearch` to miss overlaps — behavior the
whole placer depends on.

The port stored the Hilbert code as an unsigned `number` and sorted ascending-
unsigned (`DtBag` comparator `(a,b)=>a-b`), producing a *different* (correctly-
covering) tree → different overlap results → different label placement → for one
oversized edge label, LEFT vs RIGHT of its anchor → raw bbox extended ~785pt →
uniform +785.47 x-shift of the whole canvas (5142 xdot diffs).

## The fix (src/label/xlabels.ts, xlhdxload)

```ts
const key = hdHilSFromXy(Math.trunc(cx), Math.trunc(cy), order) | 0;  // was: no `| 0`
```

`| 0` = ToInt32, matching C's unsigned→`int` store. The `DtBag` comparator
`(a,b)=>a-b` is then correct on signed int32 values. After the fix, the port's
R-tree insertion order (rect-for-rect) is **bit-identical** to native, the tree
structure matches, and the placement sequence matches (131/132 identical; the
1 residual has identical `bp.pos` and `area=0`, so identical placed position —
`bp.n` 1-vs-0 is immaterial to output).

## Verification

- **circo/graphs-b81**: was 5142 diffs (+785.47 x-shift) → **PASS, 0 diffs, maxΔ 0.00**.
- Insertion order after fix: rect sequence **identical** to native.
- Placement sequence: 131/132 bit-identical; the 1 residual does not change output.
- Regression spread (live xdot compare, tol 0.01):
  - 28/28 real graphs PASS under **both** circo and twopi (abstract, alf, b3,
    unix, nhg, KW91, ER, Heawood, Petersen, states, shells, …; 2 "errors" =
    nonexistent files).
  - b-series large-canvas graphs (b3,b7,b33,b51,b56,b71,b77,b80) PASS under circo.
  - twopi accepted entries **unchanged**: b29, linux.i386-b29 (1 diff, Δ12),
    2239 (1 diff, Δ10.8) — still their documented A9 bounds (twopi b81 canvas is
    smaller; keys < 2³¹, fix is a no-op there → verdict unchanged). Not stale.
  - Also passes now under circo: b29, linux.i386-b29, 2239, states (side benefit).
- `tsc --noEmit`: clean. Label unit tests: 69 pass. accepted-divergences test: 6 pass.

## Note for later

The `graphs-b29` twopi acceptance bound explicitly reads "flip is a placeLabels
tie on 1-ULP-drifted surrounding objects" — the same *mechanism family* as this
bug. Under twopi its canvas keeps all keys < 2³¹ so the signed/unsigned order is
identical and the fix doesn't touch it; its remaining 1-diff flip is a separate
(genuine) tie. Left as-is (registry is outside this task's write-set).
