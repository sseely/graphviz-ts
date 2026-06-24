<!-- SPDX-License-Identifier: EPL-2.0 -->

# Architecture Decisions

## D1 — Spike before fix; do not pre-commit a fix file {#d1}

**Context:** The under-segmentation cause is not localized (box corridor vs
smode segmentation vs an off-by-one in piece accounting).
**Decision:** Batch 1 (S1) instruments C + port to pin the exact site; the fix
file/approach is decided only then.
**Consequences:** T2 is a template until S1 fills it in. Costs one batch boundary.

## D2 — C is the spec; pin to instrumented oracle values {#d2}

**Context:** Routing geometry is decades of load-bearing C behavior (CLAUDE.md).
**Decision:** Dump C `routesplines_`/`Proutespline` inputs+outputs (rebuild
`gvplugin_dot_layout` → `/tmp/gvplugins`, gate on `getenv("PROBE_EDGE")`) for
`sleep--runmem` on p3 and pin the port to them. No "cleaner" reimplementation.
**Consequences:** Requires a C rebuild + instrumentation harness (S1), reverted
after dumping. Recipe: memory `recover-slack-and-c-harness`, prior mission
`plans/edge-spline-routing/`.

## D3 — Scope to the under-segmentation class only {#d3}

**Context:** dot routing has many divergence classes; routing-ORDER is already
fixed (mission `edge-spline-routing`).
**Decision:** Fix only the long-edge piece-count under-segmentation. If S1/T2
surfaces an unrelated routing or layout bug, log it and stop — do not chase it.
**Consequences:** Keeps the mission bounded and the regression surface small.

## D4 — Regression floor: 0 regressions, byte-match ≥ 281 {#d4}

**Context:** `main` (`465b24a`) has 281 byte-match rows; none must regress.
**Decision:** Acceptance requires `byte-match ≥ 281` and **0 per-id regressions**
(survey diff vs `main`). `graphs-p3` must flip forward (diverged → structural- or
byte-match). If the fix cannot hold the floor, stop and re-scope.
**Consequences:** The fix must be narrow — gated on the exact corridor/segmentation
condition that triggers the missing split, not a global change.

## D5 — rankdir_dot rows: flip if same class, else document + report {#d5}

**Context:** The user requires the whole under-segmentation class to leave
`diverged`, including `*-rankdir_dot`/`dot2`. But those rows have a larger
maxDelta (~34–37 vs p3's 0.48) and memory `size-attr-scaling-done` records a
SEPARATE ~7.5pt label-height LAYOUT residual on them.
**Decision:** S1 must determine, per row, whether the residual IS the
under-segmentation class (piece count) or a separate divergence. If same class →
the fix flips them (required). If a separate class blocks them → document each in
`comparisons/` and STOP-to-report; do **not** chase the unrelated layout bug
(D3). Flipping `graphs-p3` + 0 regressions is the hard floor; flipping the
rankdir rows is required ONLY if their residual is this class.
**Consequences:** Protects against an unachievable absolute while honoring the
user's intent. The report names exactly which rows (if any) are blocked by a
separate residual and why.

## D-fixsite — Localized fix site (FILLED BY S1) {#d-fixsite}

**Status:** RESOLVED — `src/layout/dot/position.ts` `normalizeXcoords`.

**Site:** `normalizeXcoords` (NOT box-corridor geometry, NOT smode segmentation,
NOT the fitter — the brief's premise was wrong; the spike re-localized it).

**Instrumented C-vs-port diff (`sleep--runmem`, p3):**

The faithful fitter `routeSpline` is the *amplifier*, not the cause:
`isolate.mjs` fed each side's real `Proutespline` inputs into the port's own
fitter — **port's `pl` → 3 pieces, C's `pl` → 4 pieces**, regardless of which
side's `poly` (box corridor) was used. So the lever is the `Pshortestpath`
output `pl`, and the fitter is faithful (premise on `route.ts` holds).

The two `pl`s are **identical modulo a frame translation of +138.36728** except
the bend points sit on box right-walls that round differently:

| | C (its frame) | C (+138.367 → port frame) | port |
|---|---|---|---|
| `pl[1].x` (rank y=252 wall) | 23 | 161.37 | **162** |
| `pl[2].x` (rank y=180 wall) | 8 | 146.37 | **146** |

Those walls come from `maximal_bbox`'s `round(b)` (faithfully ported — C uses the
same `round`). The inputs differ only in the **absolute coordinate frame**: every
port node x = its C value **+ 138.36728** uniformly (sleep 203.36728 vs C 65; the
three chain vnodes all share fractional `.36728`). Because the offset's fraction
is non-integer, `round(b_C + 138.367) = 162` while `round(b_C) = 23` (b_C ≈ 23.2
straddles the .5 boundary) — the rounded walls diverge sub-pixel, the `pl`
diverges sub-pixel, and the knife-edge fitter flips 4→3.

**Origin of the offset:** `normalizeXcoords` shifts every node x by
`minNormalLeftX = leftmost.coord.x − leftmost.lw`. `lw` (half node-width) is
non-integer (e.g. 29.86), so the shift delta is non-integer → it converts the
network-simplex integer x-frame into a non-integer one. C does **not** normalize
here (the existing port comment even said it is "a no-op in C"), so C routes in
its integer frame.

**Decision:** Round the shift delta — `shiftAllXcoords(g, Math.round(minX))`.
This keeps the routing frame integer (matching C's invariant), so `maximal_bbox`
rounds box walls exactly as C does. The fraction washes out in the postprocess
translate (`bb.LL.x` shifts by the same fraction), so **final node positions are
unchanged**. Pinned to C: C's routing frame is integer.

**Consequences / blast radius:** Changes the *internal routing frame* of **every
dot graph** by a sub-pixel fraction (final node positions preserved). Verified
end-to-end: p3 `sleep--runmem` flips 3→4, full p3 SVG geometry now byte-identical
to the oracle. Regression risk = other knife-edge long-edge fits flipping; gated
by the Batch-3 survey (D4: byte-match ≥ 281, 0 per-id regressions). The four
`*-rankdir_dot`/`dot2` rows are **NOT** resolved by this x-axis fix (their
residual survives in the LR-rotation/other-axis frame) → classified separate
(D5), documented, not chased (D3).
