<!-- SPDX-License-Identifier: EPL-2.0 -->
# graphs-mike L→U divergence — T0 finding (Batch 0)

## TL;DR — the L→U over-segmented spline is a SYMPTOM, not the cause
The cause is **node L assigned to the wrong rank** (one rank too high), which is
upstream of all edge-spline routing. The mission's pinned premise ("Counts + bbox
MATCH … Pure edge geometry") is **incorrect**: node L's *y* (rank) differs by
exactly one rank-step (72px) = the maxΔ 72.12. The L→U spline only over-segments
because it must now span 2 ranks (L→U) instead of 1.

## Evidence (oracle vs port, mike.gv)
- Node L: **C cy=-450 (rank 4)** vs **port cy=-522 (rank 3)**. Every other node is
  byte-identical except J (minor 9px x-only, separate). viewBox matches (384×576).
- Rank set is identical both sides; only L's membership differs:
  - C:   r3(-522)={E,J,Q,V}    r4(-450)={A,G,I,L,T,W}
  - port:r3(-522)={E,J,L,Q,V}  r4(-450)={A,G,I,T,W}
- L's only edges: K→L (in) and L→U (out). K@r2, U@r5 → L feasible at r3 or r4, both
  give total edge length 3 → a network-simplex **balance tie-break**, NOT routing.

## Divergent stage: `TB_balance` equal-rank processing ORDER (network simplex)
Paired instrumentation of C `lib/common/ns.c:TB_balance` and port
`src/layout/dot/ns.ts:tbBalance` (MIKEDBG-gated, both reverted clean):

- **Pre-sort `Tree_node`/nlist order is byte-IDENTICAL** both sides
  (`a@2,A@4,M@5,…,L@3,K@2,E@3,…`). Pre-balance ranks + nrank census identical
  (r3 n=6, r4 n=5).
- The divergence is the **sort itself**:
  - C `LIST_SORT` → `gv_list_sort_` → **libc `qsort`** (`lib/util/list.c:337`) —
    **unstable**, macOS-libc-specific. Reorders equal-rank nodes:
    `r3 → [L,J,E,V,Q,m]` (L FIRST).
  - Port `tbSortNodes` uses `Array.prototype.sort` — **stable** (ES2019+). Keeps
    pre-sort order: `r3 → [V,Q,m,L,E,J]` (L 4th).
- Consequence at L's processing (low=3, high=4, inw=outw=1, choice starts at low,
  moves up only on **strict** `nrank[i] < nrank[choice]`):
  - **C**: L processed first → sees `nrank[3..4]=[6,5]` → 5<6 → **L→r4** ✓
  - **port**: L processed 4th (m already rebalanced off r3) → `nrank[3..4]=[5,5]`
    → tie favors low → **L→r3** ✗

## Structured finding (interface for T1)
```
divergentStage: "rank-balance (TB_balance), NOT edge-spline routing"
cValue:   L→rank4 (cy=-450); r3 post-sort order [L,J,E,V,Q,m]
portValue:L→rank3 (cy=-522); r3 post-sort order [V,Q,m,L,E,J]
cRule:    lib/common/ns.c:TB_balance — Tree_node sorted by LIST_SORT==libc qsort
          (UNSTABLE); equal-rank nodes processed in qsort's permutation, mutating
          nrank as it goes; choice = least-crowded rank in [low,high], strict '<'
          (ties favor low).
fixTarget: src/layout/dot/ns.ts::tbSortNodes  (the sort) — BUT this is the
          network-simplex rank-balance phase, OUTSIDE the edge-spline-routing
          surface named by the brief. SCOPE CHANGE — see below.
```

## ⚠ Stop condition tripped — scope is rank assignment, not edge-spline routing
Per README stop condition #1 ("Root cause falls OUTSIDE the edge-spline-routing
surface … → stop, reassess scope") and T0 boundary ("Ask first / stop if the
divergence is NOT in edge-spline routing"). The fixTarget is `ns.ts` (rank phase),
not `edge-route-chain.ts` / `splines.ts`. K→L (shared node L) resolves downstream
of the rank fix, as predicted — but via ranking, not spline routing.

## Fix options (for human decision — both touch shared `ns.ts`)
- **A. Port macOS/BSD `qsort` into `tbSortNodes`** so the unstable permutation
  matches the oracle. Faithful ("port the C, incl. its sort"). RISK: shared across
  every dot graph's rank balance; reproduces one platform's libc qsort exactly
  (Apple Libc qsort.c); net effect unknown until full survey. Could fix + regress.
- **B. Quarantine** mike/share/windows-mike as oracle-platform-(libc-qsort)-
  dependent, like the accepted Apple-libm ULP tie-breaks
  ([[2368-flat-geom-getmainedge-eddist-done]]). Zero risk; objective unmet.

Recommend A only if the survey gate (Batch 2) shows net-positive; otherwise B.
