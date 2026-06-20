# Architecture Decisions — nonadjacent-flat-5ne8nw

Locked before execution. Contradicting one is a STOP condition.

## AD-1: Pin the sub-step before fixing — prove translation-equivariance is the lens
**Context:** The pre-mission diagnosis proved the box channel + endpoints are
identical to C modulo a uniform +27 x-translation, yet the port spline is an exact
mirror. The defect is therefore a translation-equivariance violation in
`routeSplines` or a sub-step.
**Decision:** Batch 1 reproduces the mirror on a PURE box channel (no graph),
dumps the intermediate polyline `pl` from `shortestPath` and compares it to C
`Pshortestpath`, and names the SINGLE sub-step + line where the mirror enters
(`buildPolyPoints` / `shortestPath` / `routeSpline` / `buildConstraintVectors` /
`limitBoxes`). If `pl` is already mirrored → funnel bug; if `pl` matches but the
bezier mirrors → fitter bug. No `src/` fix in Batch 1 beyond the RED test. If a
single sub-step cannot be pinned, STOP.
**Consequences:** The fix targets a proven line, not a guess.

## AD-2: Fix the equivariance violation at its source — do not special-case
**Context:** The fitter is geometry; the correct behavior is translation-
equivariance, which C has by construction.
**Decision:** Fix the absolute-coordinate dependence (or orientation bug) so
`routeSplines` becomes translation-equivariant generally — do NOT add a
`5:ne->8:nw`-specific or flat-edge-specific branch. The fix must be the faithful
match to C's algorithm at the pinned line, nothing more. Keep it minimal; reuse
existing helpers; no new abstractions (CLAUDE.md YAGNI).
**Consequences:** One geometry fix; no special cases to maintain.

## AD-3: Build on `main` — the #241_0 curl/arrow halves are already landed
**Context:** `aux-back-edge-curl` merged to `main` (3106329); `#241_0` is
structural-match, blocked only by this edge.
**Decision:** Branch `fix/nonadjacent-flat-5ne8nw` off `main`. Do not revert or
re-derive the curl/arrow fixes. The new equivariance test is the red test;
`5:ne->8:nw` byte-match + `#241_0` structural→byte is the acceptance.
**Consequences:** This mission delivers the final `#241_0` byte-match.

## AD-4: Full-corpus regression is the crux (highest blast radius of the saga)
**Context:** `routeSplines` routes EVERY box-channel edge in the library (all
multi-rank regular edges, all non-adjacent flats), not just the aux or back edges.
memory `bucket-fix-rebucketing`: judge by per-id verdict deltas.
**Decision:** Acceptance = (a) the new equivariance test passes and `5:ne->8:nw`
byte-matches native `dot`; (b) EVERY curated golden byte-identical except the
intended `#241_0` family; (c) `survey.ts` shows `#241_0` structural-match→
byte-match (or strictly smaller maxDelta) AND ZERO new `diverged`/`structural`
verdicts corpus-wide (errored↔timeout flakiness on already-failing ids excluded).
Any out-of-family golden flip or any genuine new diverge ⇒ STOP. Record the per-id
delta table.
**Consequences:** The blast-radius fear is an explicit gate; a broad regression
means the geometry fix is wrong, not the goldens.

## AD-5: Native C oracle; C instrumentation ephemeral
**Context:** memory `oracle-native-not-wasm`, `recover-slack-and-c-harness`,
`instrument-c-before-quarantine`.
**Decision:** Validate only against native C `dot`. Instrument by rebuilding
`gvplugin_dot_layout` into `/tmp/gvplugins` (NOT libgvc); restore the C tree clean
(`git -C ~/git/graphviz checkout`) + verify the oracle cache stays native when
done. The repo complexity hook flags `dotsplines.c`/`routespl.c` as >500 lines —
a FALSE POSITIVE on the upstream spec file; never split C source. Never validate
geometry against the instrumented binary.
**Consequences:** Reversible; oracle remains ground truth.
