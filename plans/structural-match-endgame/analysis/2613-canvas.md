<!-- SPDX-License-Identifier: EPL-2.0 -->
# T5 — 2613 canvas-extent Δ50 (diagnosed 2026-07-04, agent-verified)

**mechanism**: `updateBBForLabel` (src/common/xlabels-place.ts:280-288) grows the
graph bbox with `lp.dimen.x/y` unconditionally; C's `addLabelBB`
(lib/common/utils.c:569-595) swaps width/height under `GD_flip` (rankdir=LR/RL).
Same bug class as the updateBB flip fix (splines-label.ts:298-311, 2026-07-04)
— a duplicate implementation that never got the swap.

**origin**: src/common/xlabels-place.ts:280-288

**causalChain**: xlabel force-placement positions/sizes byte-identical both
sides; GD_bb identical BEFORE addXLabels; diverges only AFTER → isolated to
updateBBForLabel. Raw-frame error 2.38pt = (xlabel width 9.56 − height 4.80)/2
exactly — the swap omission, arithmetically.

**ruledOut**: the prior "point-rankgap"/ranking-time hypothesis — GD_bb before
addXLabels already identical (matched instrumentation port console.error vs C
fprintf in postproc.c, C repo reverted + dot rebuilt afterward).

**verdict**: fix

**proposedWriteSet**: src/common/xlabels-place.ts (prefer reusing the correct
updateBB from splines-label.ts over keeping two divergent implementations) +
focused test; follow-up note in bucket-canvas-extent.md.

**evidence**: throwaway flip-conditional swap in the worktree → GD_bb matches C
exactly, SVG height 317pt exact, compareSvg(deterministic) pass with 0 diffs.
