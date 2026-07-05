<!-- SPDX-License-Identifier: EPL-2.0 -->
# R1 — 2371 (diagnosed 2026-07-05) — ACCEPT (A3 extension, qualified)

**mechanism**: A3 mirror-tie fingerprint at output level: both divergent
edges (g[9263] r6837mid--r9687mid, g[23859] r38mid--r8699mid) emit the EXACT
REVERSAL of the oracle's control-point sequence; shared knot x identical,
knot y flipped by exactly Δ16.8 on BOTH unrelated edges (top/bottom split
fractions swapped 75.93/59.37 ↔ 59.37/75.93). All other 36,900+ elements
byte-identical (fresh renders, this pass — reconfirms T18).

**origin (qualified, MEDIUM confidence)**: route.ts:182-212 findMaxDev
tolerant tie-break vs C's Apple-libm hypot strict `>` — the documented A3
site. NOT captured live: 2371 packs ~199 components, so pathplan-internal
coordinates don't align with page coordinates; three instrumentation
strategies (windowed findMaxDev probe, RouteHelper window, whole-render
value-fingerprint over 795 hits) could not correlate the two page-space
edges to their pathplan-local calls. Future stronger pass: map per-component
pack offsets first (read the pack-offset computation), else it won't converge.
Not fully excluded: tie resolving in straight-mode segmentation or post-clip
recover_slack rather than literally at route.ts:209.

**ruledOut**: broad NS/mincross divergence (fresh full-tree compare: only the
2 edges differ); arbitrary logic drift (exact value-set reversal + identical
Δ on unrelated edges = opposite tie-break, not computation defect);
label-vnode divergence (label anchors byte-identical).

**verdict**: accept — extend A3 registry with 2371, prose stating the
qualified origin confidence honestly. proposedWriteSet: registry trio only
(R6). C-side confirmation deliberately deferred (R2's live instrumentation
in the shared C tree).

**evidence**: /tmp/2371-r1-{oracle,port}.svg; compareSvg 22 diffs maxΔ
16.799999999999955; decoded control-point sequences; 3 reverted worktree
instrumentation attempts.
