# Architecture Decisions — group-adjacent-flats

Locked before execution. Contradicting one is a STOP condition.

## AD-1: Faithful grouping ORDER — pin to C, do not guess
**Context:** `buildFlatAux`/`copyFlatSplines` key the aux frame off
`edges[0].tail`. The curl only appears when `edges[0]` is the FORWARD edge
(`auxt=clone(node2)`). C derives this from `edgecmp`'s `AGSEQ(getmainedge)`
tiebreak. The diagnosis dump was internally inconsistent about which edge is
`edges[0]`, so the order is NOT yet proven.
**Decision:** T1 instruments C `make_flat_adj_edges` to dump, for the `#241_0`
2↔3 group: the exact `edges[]` membership + order, `e0` (tn/hn), and which clone
becomes `auxt`/`auxh` + each clone's aux direction (fwd/back) + size. The port's
in-group sort MUST reproduce that `edges[0]`. If C's order is not deterministic
or `edges[0]` is the back edge, STOP (the mechanism/diagnosis is wrong).
**Consequences:** The one detail that can silently produce size 4 again (wrong
`edges[0]`) is locked by oracle before any src edit.

## AD-2: Caller-side change only — reuse the cnt=N aux internals
**Context:** `makeFlatAdjEdges`/`buildFlatAux`/`copyFlatSplines` already iterate
`cnt`/`edges[]` and install all members (`copyFlatSplines` via `aux.alg`).
**Decision:** The change lives in the dispatch path
(`src/layout/dot/edge-route.ts`: `routeFaithfulSidePort` / `routeForwardEdge` /
`routeDotEdges`): collect the adjacent-flat group, order per AD-1, call
`makeFlatAdjEdges(g, group, group.length, et)` ONCE, and let the existing
`if (e.info.spl !== undefined) continue` dedup skip the other members. Do NOT
rewrite `buildFlatAux`, `repositionFlatAux`, `copyFlatSplines`, or `splines.ts`
internals. `hvye` selection, the pseudo-edge fallback, and `cnt` handling are
already faithful (diagnosis-verified).
**Consequences:** Minimal blast radius; the proven aux internals are untouched.

## AD-3: Group only the adjacent port-bearing flat case
**Context:** The port has several flat paths: `makeSimpleFlat` (no-port),
labeled-flat (`makeFlatLabeledEdge`/`makeSimpleFlatLabels`), non-adjacent
(`routeFlatEdgeFaithful`), and the aux path (`makeFlatAdjEdges`). Only the aux
path diverges; the others match C and must not change.
**Decision:** Grouping applies ONLY to edges that currently reach
`makeFlatAdjEdges` (adjacent, same-rank, side-port, `ED_adjacent`). The group key
is the unordered pair `{tail,head}`; collect both directions and all parallels.
Each group is built and routed exactly once (idempotent regardless of
`routeDotEdges` iteration order). No-port / labeled / non-adjacent dispatch is
untouched.
**Consequences:** Regression surface is bounded to adjacent-flat-with-ports.

## AD-4: Oracle-pinned, regression-gated (the golden-risk guard)
**Context:** The aux path serves ALL adjacent flats; the prior 4 missions feared
golden-risk and never landed the fix. memory `bucket-fix-rebucketing`: judge by
per-id verdict deltas, not bucket counts.
**Decision:** Acceptance = (a) `#241_0` `3:sw->2:se` aux size 4→7 and its
corpus verdict moves `diverged`→matches (or strictly smaller maxDelta); (b) EVERY
curated golden conformant EXCEPT the intended `#241_0` adjacent-flat family;
(c) `test/corpus/survey.ts` shows ZERO new `diverged` verdicts corpus-wide. Any
out-of-family golden flip or any new diverge ⇒ STOP. A bucket with a changed
case is not "done" until its comparison verdict is recorded in the journal.
**Consequences:** The fear that blocked four missions becomes an explicit pass/
fail gate, not a vibe.

## AD-5: Native C oracle; C instrumentation ephemeral
**Context:** memory `oracle-native-not-wasm`, `recover-slack-and-c-harness`.
**Decision:** Validate only against spawned native C `dot`. Instrument C by
rebuilding `gvplugin_dot_layout` into `/tmp/gvplugins` (NOT libgvc); restore the
clean plugin and verify the oracle SVG cache stays native-C-faithful when done.
Never validate geometry against the instrumented binary.
**Consequences:** Reversible; the oracle remains ground truth.
