# Architecture Decisions — flat-aux-curl-diagnosis

Locked before execution. Contradicting one is a STOP condition.

## AD-1: Diagnosis only — zero edits to the layout path
**Context:** Three prior sessions ended at the same resume point because the
aux dump was folded into a *fix* attempt and hit golden-risk (the aux path
serves all adjacent flats).
**Decision:** This mission makes **no edit** to `splines-flat.ts`, `rank.ts`,
`mincross.ts`, `splines.ts`, or any layout file. New files live only under
`test/diagnostic/` and `plans/`. Deliverable = the named divergent structural
decision, written to the journal + a findings file.
**Consequences:** Golden-risk is removed entirely. A fix becomes a separate
mission scoped *after* the line is named. If diagnosis cannot proceed without a
layout edit, that itself is the finding — STOP and scope the fix.

## AD-2: Minimal synthetic repro is the primary subject
**Context:** Every prior mission fought the full `#241_0` graph; its aux graph
carries unrelated nodes that make rank/order dumps noisy.
**Decision:** The primary subject is the **smallest** graph that reproduces aux
spline size 4-vs-7 for a both-bottom-port same-rank back edge (≈ two nodes,
`rank=same`, `b:sw -> a:se`). `#241_0` is used **only** for the final
confirmation in T3.
**Consequences:** C and port aux graphs become trivially comparable (a handful
of aux nodes). If the minimal repro does **not** reproduce the divergence, that
is itself a finding (the cause depends on graph context) — log and escalate.

## AD-3: Input-parity before layout instrumentation
**Context:** The divergence may be an aux-graph *construction* gap, not a
*layout* gap. Prime suspect: port `buildFlatAux` omits C's `rank=source`
subgraph for `auxt` (`dotsplines.c:1170-1179`).
**Decision:** T2 diffs the aux-construction **inputs** C-vs-port first:
(a) `rank=source` subgraph pinning `auxt`; (b) `hvye` weight=10000 / pseudo-edge;
(c) cloneEdge direction (`agtail(e)==tn ? auxt→auxh : auxh→auxt`);
(d) `GD_flip`/rankdir; (e) `dot_init_node_edge`. Only if inputs match does T3
instrument `dot_rank`/`dot_mincross`/normalize.
**Consequences:** A missing input *is* the bug and is found by source reading in
minutes, not by deep C instrumentation.

## AD-4: Canary-first — validate the harness on the agreeing case
**Context:** The recurring failure was "the dump didn't fire cleanly" — and the
probes could not tell harness-failure from real divergence.
**Decision:** The dump harness must first reproduce the **agreeing** forward
`2->3` case (size 7 on both C and port) before being aimed at `3->2`. A harness
that disagrees on the agreeing case is untrusted → STOP. (Pattern:
`large-port-batch-oracle` canary.)

## AD-5: Dump the upstream structure, not the aux spline
**Context:** Prior probes dumped aux spline coords (size, X) — the downstream
symptom.
**Decision:** Capture, per pipeline stage on `auxg`, for both C and port:
after `dot_rank` → `ND_rank` of every aux node + `GD_maxrank`; after normalize →
the virtual-node chain per cloned edge + per-rank node order. The rank+chain is
the decision; the spline is its consequence.

## AD-6: C instrumentation is ephemeral; oracle stays native
**Context:** Memory `recover-slack-and-c-harness` / `oracle-native-not-wasm`.
**Decision:** Instrument C by rebuilding `gvplugin_dot_layout` into
`/tmp/gvplugins` (NOT libgvc). When the task ends, restore the clean plugin and
verify the oracle SVG cache remains native-C-faithful. Never validate against an
instrumented binary's geometry.
