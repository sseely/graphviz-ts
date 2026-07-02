<!-- SPDX-License-Identifier: EPL-2.0 -->
# Decisions (approved by user, 2026-07-02)

1. **D1 gated diagnosis.** Context: three symptom classes may share a
   root. Decision: one diagnosis batch for all three, hard gate before
   fixes. Consequence: no wasted fixes on unpinned mechanisms.
2. **D2 faithful fix at origin.** Context: standing project policy
   (C is the spec). Decision: mirror conc.c / lib/ortho / cluster-label
   emit exactly; instrument C first. Consequence: no per-graph hacks.
3. **D3 residual disposition.** Context: ortho maze corridor tie-breaks
   (2361/2620) are a documented accepted-residual class. Decision:
   residual numeric deltas may close as that class only with equal-cost
   evidence; otherwise they are defects. Consequence: no lazy
   "tie-break" claims.
4. **D4 main-loop sequential.** Context: ~/git/graphviz is a shared
   mutable instrumentation target. Decision: no parallel subagents for
   diagnosis. Consequence: batches are sequential; tasks remain one
   commit each.

Rollback classification: **Reversible** (all tasks). No irreversible
changes anticipated; none authorized.
