# Architecture Decisions — aux-back-edge-curl

Locked before execution. Contradicting one is a STOP condition.

## AD-1: Diagnose before fixing — prove the mechanism, never assume
**Context:** This saga's recurring failure is declaring a fix sufficient without
running the actual config (the 5th mission's "grouping alone suffices" was never
tested at cnt=N on the port side and was false). 
**Decision:** Batch 1 instruments BOTH C `make_regular_edge` AND the port's
back-edge path (`routeFaithfulAdjacentBack`/`routeRegularEdgeFaithful`) on the
SAME aux back edge (`#241_0` `3:sw->2:se` clone), and names the single mechanism
that makes C curl (size 7) and the port go straight (size 4). No `src/` edit in
Batch 1. The candidate mechanism is "the back edge doesn't honor its corner
ports (the forward path does, the back path doesn't)" — confirm or refute by
dump, do not assume.
**Consequences:** The fix targets a proven line, not a guess.

## AD-2: Minimal, condition-gated change — bound the blast radius
**Context:** `routeFaithfulAdjacentBack` routes EVERY adjacent-rank back edge in
every graph; a broad change risks wide golden churn.
**Decision:** Prefer the narrowest gate that fixes `#241_0` — e.g. route an
adjacent back edge through the **side-port curl path** only when
`hasSidePort(e)` (port-less straight back edges keep their current path). Do NOT
change straight back-edge routing for port-less edges. If the minimal gate still
regresses, narrow further (aux-only) or STOP.
**Consequences:** Most existing back-edge goldens are untouched by construction.

## AD-3: Build on the grouping branch — do not re-derive it
**Context:** The grouping half is done and banked on `fix/group-adjacent-flats`
(golden-neutral, proven). 
**Decision:** Branch `fix/aux-back-edge-curl` off `fix/group-adjacent-flats`. The
grouping change is a prerequisite and stays. The xfail tripwire
`splines-flat-group.test.ts` is the red test; on success, flip it to a normal
passing `it(...)` (remove `.fails`).
**Consequences:** Both halves compose into the complete `#241_0` fix.

## AD-4: Full-corpus regression is the crux (golden-risk guard)
**Context:** Back-edge routing is global; this is the highest-blast-radius change
of the saga. memory `bucket-fix-rebucketing`: judge by per-id verdict deltas.
**Decision:** Acceptance = (a) the xfail tripwire flips to passing and `#241_0`
moves `diverged`→matches (or strictly smaller maxDelta); (b) EVERY curated golden
byte-identical except the intended `#241_0` family; (c) `survey.ts` shows ZERO
new `diverged` verdicts corpus-wide (errored↔timeout flakiness on already-failing
ids excluded). Any out-of-family golden flip or any new diverge ⇒ STOP. Record
the per-id delta table.
**Consequences:** The fear that has stalled this fix becomes an explicit gate.

## AD-5: Native C oracle; C instrumentation ephemeral
**Context:** memory `oracle-native-not-wasm`, `recover-slack-and-c-harness`.
**Decision:** Validate only against native C `dot`. Instrument by rebuilding
`gvplugin_dot_layout` into `/tmp/gvplugins` (NOT libgvc); restore clean + verify
the oracle cache stays native when done. Never validate geometry against the
instrumented binary.
**Consequences:** Reversible; oracle remains ground truth.
