<!-- SPDX-License-Identifier: EPL-2.0 -->
# T2 — 2413_1/2413_2 (diagnosed 2026-07-04) — SPLIT: fix (swapBezier) + accept (A3 tie)

Bucket "vspace/label-reservation" hypothesis REFUTED — node positions and
viewBoxes now byte-identical (fixed by intervening missions). Residual = two
independent spline mechanisms.

## Mechanism A — findMaxDev hypot symmetric-tie (Δ67.65 / 99.54 / 99.55) → ACCEPT
Labeled 2-cycle back edges route through the label-vnode slit corridor whose
two corners tie at EXACTLY equal deviation (measured diff ≤ 5.7e-13). C
(route.c:139, dist = Apple hypot) flips winner per ABSOLUTE coordinates
(exact translates of the same corridor resolve differently in one process!);
the port keeps-first (translation-equivariant). Identical mechanism to the
accepted A3 family (2368, 241_1, b100/b104). Delta = label-vnode width.
ruledOut: route/box divergence (C_BOX/C_CAI dumps byte-identical corridors,
exact translates ×3), 2cycle double-count recurrence (nodes byte-identical),
routing order (same order both sides; only coordinate-dependent noise flips).

## Mechanism B — swapBezier over-allocated reverse (Δ1922.26, 2413_2 g51) → FIX
SAME bug as T1/hub-fanin: full-array reverse rotates 3 stale (0,0) slots to
the front when clip shrank size (13→10) on a reversed back edge. C_FIN vs
CAI3 dumps byte-equal for all 4 edges of the family → clip inputs identical;
emit decode shows port g51 = [T(0,0)×3, reversed[0..6]]. Causal: size-bounded
reverse removes Δ1922 entirely; 2413_2 drops to exactly the 3 Mechanism-A
edges; controls 1644/1332 0-diff; 2368 stays at its accepted diffs.

**verdict**: fix (B — same write-set as T1: splines.ts swapBezier + test)
+ accept (A — registry family extension for 2413_1 and post-fix 2413_2)

**proposedWriteSet**: splines.ts/splines.test.ts (shared with T11); registry
trio for the A3 extension (T12 = batch-3 registry writer, replacing T13
which is now a plain fix).

**evidence**: agent transcript — C findMaxDev dump (maxi flips 1↔2 per
instance; 3 ties in 2413_1, 4 in 2413_2), C clip_and_install C_FIN dumps,
port DBG_2413/CAI3 dumps, worktree causal fix + controls. C tree reverted
(additive env-gated instrumentation removed; pathplan/gvc rebuilt; the
then-live T7 instrumentation preserved untouched).
