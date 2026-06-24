<!-- SPDX-License-Identifier: EPL-2.0 -->

# Decision journal

Append one row per non-trivial judgment call, gate result, AD-4 write-set ask,
or stop.

| date | task | decision / event | rationale |
|---|---|---|---|
| 2026-06-23 | plan | mission scoped: diagnose mincross perf on 2108 (mincross-bound ~80%, NOT emission-bound per profile), then execute byte-safe fix. Batch 2 auto-proceeds if byte-safe (human). Write-set = mincross*.ts + ask-gate (AD-4) for others. | profile: reorderInner 47% + accumCross 17%; emission ~0.1%. Primary hypothesis: port ncross()/passes diverge from C (cf. leaveEdge + accumCross-tiebreak precedents). |
| 2026-06-23 | D1 | instrumented port mincross (temp counters in mincross-utils/-cross/-order, reverted; driven by instr-port.ts via tsx). | counters captured for 2108/b100/2471; `git status src/` clean post-revert. |
| 2026-06-23 | D2 | instrumented native C mincross.c (matching counters + MCDUMP at dot_mincross exit), rebuilt dot_layout plugin→/tmp/gvplugins, captured dumps, then `git checkout` + rebuilt CLEAN plugin (no MCDUMP) so survey oracle is restored. | AD-1: instrument C before concluding. C build is make/cmake; only dotgen+plugin rebuilt. |
| 2026-06-23 | X1 | implemented per-op opt in mincross-order.ts reorderFindLp/Rp/Inner: read-once CSE on node.info.mval, hoist loop-invariant vlist[lp], allocation-free reorderFindRp via reused scratch (~1.6e9 allocs removed). New test mincross-reorder-perf.test.ts (boundary + scratch-reuse). NO control-flow/value change. | AD-2 Path 2. Window object per-nelt alloc left alone (~100s K, not the 1.6B path; would break tested signature). No AD-4 ask needed — all edits within mincross*.ts. |
| 2026-06-23 | X2 gate | **SURVEY GATE PASS**: byte-match 312→312, structural 256→256, **0/796 changed verdicts** vs parity-baseline. typecheck 0, full test 2334 pass (+5), build 0. | AD-3 byte-identity holds corpus-wide. |
| 2026-06-23 | X2 timing | bundle best-of-2: 2108 83.6→72.3s (−13.6%), b100 37.7→30.1s (−20%), 1718 30.6→24.6s (−20%), b104 33.2→29.9s (−10%). svg_bytes identical all 4. | Per-op constant-factor win as predicted; ≤3× target N/A (was iteration-gap-contingent, disproven). Honest: 2108 still >20s (faithful O(W²) reorder on ~3700-wide rank). |
| 2026-06-23 | D3 | **VERDICT: per-op constant factor (AD-2 Path 2), NOT iteration-count gap.** Every structural counter byte-identical port==C: 2108 reorderInnerIters=1,591,556,868 (both), reorderExchanges=484,932,627 (both), transposeRounds/Steps/Swaps + ncross/rcross/reorder calls all exact; per-pass `mincross:` Verbose trace byte-identical. Only diff: port accumCrossPairs = EXACTLY ½ C (single-pass both-direction accumCross — port already more efficient). Target=reorderInner + reorderFindLp/Rp/left2right per-op cost (1.6B faithful iters, V8 property-access bound). | Iteration-count fix path disproven; algorithm change forbidden. ≤3× target was contingent on iteration gap → expect only a constant-factor drop. findings.md has full side-by-side. Proceeding to Batch 2 (byte-safe per-op opt, auto-proceed per human). |
