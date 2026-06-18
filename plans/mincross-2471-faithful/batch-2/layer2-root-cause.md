# Layer-2 root cause (FOUND + FIXED) + Layer-3 blocker (NEW, out of scope)

## TL;DR

The brief's "Layer 2 = transpose non-convergence" is a **symptom**. The true
root cause is **`saveBest` / `restoreRank` / `restoreBest` ignore the `vStart`
window offset** — the *identical bug class* as Layer 1 (medians/reorder),
living in the save/restore-best machinery. Fix verified: with it applied,
**mincross runs to completion in ~3.5s** (matches C's ~3s; `maxphase=2` render
of 2471 = 3.6s, full 1876-test suite green, tsc + build clean, C untouched).

**However**, the now-correct mincross order exposes a **Layer 3** blocker:
`dotPosition`'s x-coordinate **network simplex** (`rank(g, 2, nsiter2(g))`,
`position.ts`) does **not converge** on the correct-order aux graph and hangs.
This is a *different subsystem*, outside the pre-authorized mincross write-set
(AD-5) → STOP for authorization (see decision journal).

## How it was localized (evidence chain)

All probes were temporary `globalThis` hooks driven by the esbuild bundle over
`~/git/graphviz/tests/2471.dot`; all reverted (tree clean, `grep` confirms).

1. **2471 hangs with T1 applied** (`timeout 90` → rc 124). Confirmed premise.
2. **Transpose `delta` trace**: some `transpose()` calls run **4000+ inner
   iterations** with `delta` plateauing at a *constant positive value* (observed
   plateaus 89, 5221, 11116 — `5221` is the parent's number) and never reaching
   0. The `while (delta>=1)` never exits. (Early-converging calls 1-9 masked this
   on a truncated first read.)
3. **Dup-order detector at transpose entry**: the non-converging calls
   **inherit** the corruption — call 10 *enters* with `dupTotal=241`,
   `orderNeIdx=270` (node `order` ≠ its absolute slot in `rk.v`). Transpose does
   **not create** the dups; it oscillates because `exchange` is order-indexed and
   breaks once `order≠slot`.
4. **Phase-boundary desync probe**: the corruption is created **inside a
   component's `mincrossMain`** (hang never reached `after-runComponents`).
5. **`restoreBest` probe** (decisive): `pass2-preRestoreBest` is **clean**;
   `pass2-postRestoreBest` shows **dupRanks=9, orderNeIdx=548**. `restoreBest`
   creates the desync. It calls `restoreRank`, which iterated `rk.v[0..n)` and
   `rk.v.slice(0, rk.n)` from index 0 — ignoring `vStart`. `saveBest` has the
   same `rk.v[i]`-from-0 bug.

## Why C is fine

C `save_best`/`restore_best` read `GD_rank(g)[r].v[i]` and
`qsort(GD_rank(g)[r].v, GD_rank(g)[r].n, …)` — where `.v` is the **already-offset
window pointer** (advanced by `init_mccomp`, aliased by `merge_ranks`). TS keeps
`.v` as the full root array + a separate `vStart`, so faithful ports must read
`rk.v[vStart+i]` (= `rankGet`) and operate on the window `[vStart, vStart+n)`.
The qsort comparator `nodeposcmpf` sorts by `ND_order` ascending — exactly TS's
`a.order - b.order`, so only the offset differed.

## The Layer-2 fix — src/layout/dot/mincross-order.ts

```ts
// saveBest: read the offset window
const n = rankGet(rank[r], i);               // was: rank[r].v[i]

// restoreRank: restore + re-sort the absolute window [vStart, vStart+n)
const vs = rk.vStart ?? 0;
for (let i = 0; i < rk.n; i++) rk.v[vs + i].info.order = rk.v[vs + i].info.coord.x;
const sorted = rk.v.slice(vs, vs + rk.n).sort(
  (a, b) => (a.info.order ?? 0) - (b.info.order ?? 0));
for (let i = 0; i < rk.n; i++) rk.v[vs + i] = sorted[i]!;
```

Safe at the root (vStart=0 → identity), correct for windowed components/clusters.

## Verification (Layer 2 — PASSES)

- `maxphase=2` (rank + mincross) render of 2471: **3.6s** (C ~3s). Was: hang.
- Phase trace with fix: runComponents (~2.4s) → merge2 → 246 clusters (~0.1s) →
  remincross `mincrossMain` **returns** (`cur` oscillates 82592-83339 but
  `trying>=minQuit` bounds it) → cleanup2 → `dotMincross` **returns**.
- `npm run typecheck` 0 · `npm test` 1876 pass · `npm run build` OK · C clean.

## Layer 3 — the new blocker (OUT OF SCOPE: not mincross)

With the correct order, `maxphase=3` (mincross + position) hangs. Localized to
`dotPosition` → `rank(g, 2, nsiter2(g))` (x-coord **network simplex**,
`position.ts` / `ns-core.ts`). `nsiter2` returns `INT_MAX` (2147483647) — and
**C's `nsiter2` is also `INT_MAX`** unless `nslimit` is set (2471 doesn't), so
the cap is ported faithfully. C's network simplex still terminates quickly on
the same correct-order aux graph; **TS's does not** → a genuine network-simplex
convergence gap, exposed (not caused) by the correct mincross order. The
pre-fix code "completed" (~40-49s) only because its *wrong* mincross order
produced a benign aux graph.

**This is a separate subsystem outside the AD-5 write-set
(`{mincross-order.ts, mincross-cross.ts}`).** Fixing it needs `position.ts` /
`ns-core.ts` → STOP for write-set authorization (AD-5 / stop conditions), and
2471 end-to-end still hangs → "never leave a hang." See decision journal for the
revert-vs-keep decision presented to the human.

## Harness (all temporary, reverted)

`globalThis` probe hooks: `__TRANSPOSE_TRACE`/`__tlog` (delta trace),
`__dumpDups` (transpose-entry dup scan), `__desync` (phase-boundary order≠slot),
`__ph` (phase markers in dotMincross/runClusters/runRemincross), `__iter`
(mincrossIter cur/best), `__pp` (dotPosition sub-call markers). Driven by node
harnesses in `/tmp/ts_*_2471.mjs`. `maxphase` graph attribute (1/2/3) stops the
pipeline after rank/mincross/position respectively — the cleanest isolator.
2471 lives at `~/git/graphviz/tests/2471.dot`.
