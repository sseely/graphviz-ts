# Architecture Decisions

Six ADRs. Locked for this mission — cite by number in task files. If
execution surfaces a conflicting constraint, stop and log it to
`decision-journal.md` rather than silently overriding one of these.

## D1 — Injection stage

Batch attribution injects native pre-routing `ND_pos` only. This is the
proven POS_DUMP recipe (journal 2026-07-10, `injection A/B verdicts`
entry): dump the native `ND_pos` at the `spline_edges` entry point,
overwrite the port's `n.info.pos` with those values before its own
routing runs, then run the full comparator. A `--stage` flag exists on
the harness for manual escalation to post-init or post-overlap injection
points, for one-off diagnosis. Bulk/batch runs never use multi-stage
injection — one stage, one comparator pass, per id.

## D2 — Class acceptance

The registry `test/corpus/accepted-divergences-engines.json` gains **one
class entry per engine**: `"A1-drift"`. Membership is computed at
report time from `attribution-<engine>.json` (every id whose
`verdict == 'drift-exonerated'`) — it is not hand-enumerated in the
registry. Per-id evidence (bucket shape, injected-diff count) lives in
the attribution artifact, not duplicated into the registry. An id that
starts passing, or whose re-attribution changes verdict, drops out of
the class automatically on the next report regen — no stale-acceptance
edit required.

## D3 — Completion bar

Completion is **attribution completeness**, not pass-rate: every
diverged id ends in exactly one of `fixed` | `A1-drift-exonerated`
(class, D2) | `irreducible-accepted` (per-id, documented mechanism) |
`named-open-mechanism` (tracked, not yet resolved but classified). See
README `Objective`. A batch that raises the pass count without moving
every touched id into one of these four buckets is not done.

## D4 — Dump transport

The native `ND_pos` dump is an env-gated `%.17g` `stderr` printf patch
applied to the **native C tree** (`~/git/graphviz`), session-local only —
**never committed** to that tree. Full patch/rebuild/revert recipe:
`diagrams/injection-recipe.md`. The harness caches dumps keyed by
`(oracle sha1, id)` and **refuses to run** if the oracle binary's sha1
does not match the hash recorded with the cached dump set. Lesson: a
stale-oracle mismatch produced a false regression on twopi/2470 before
this guard existed (see `.agent-notes/twopi-2470-rca.md`) — the hash
guard is load-bearing, do not relax it.

## D5 — Mechanism mining first

The attribution harness emits classifiers per diverged id, not just a
pass/fail: `firstDiff`-shape buckets, a uniform-translation/mirror
detector (constant `dx`/`dy`, or `y`-negation across all draw-ops), and
a count-vs-position split (differing point counts vs. same-count
position drift). Batch-3's repeating rounds chase the **largest
not-cleared bucket** via one representative id at a time — never a
one-off individual id first. Representative-id diagnosis generalizes;
individual-id diagnosis doesn't.

## D6 — Oracle-error classification

An id whose oracle invocation fails is rerun up to 3× with escalating
timeouts (native binary is the oracle; a hang there is not a port bug).
3/3 failures → classify as `native-crash`, documented and excluded from
the diverged count (not a port defect). Fewer than 3/3 failures (i.e.
it eventually succeeds) → classify as `timeout-flake`, excluded from
the current run's counts but noted for the next fresh sweep.
