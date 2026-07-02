<!-- SPDX-License-Identifier: EPL-2.0 -->
# T5 — 1581 + 2825 (oracle-broken protocol, D4)

## Context
1581: oracle errors (install_in_rank line 1171 `an = 0` + "Act_2x was
already in a rankset, deleted from cluster G") → renders 20 g / 0
paths; port renders full graph cleanly. 2825: oracle's OWN
dot_concentrate fails ("concentrate=true may not work correctly" =
rebuild_vlists -1 → position aborts, exactly the port bug fixed in
fix-2183) → renders 3 elements; port full graph. NEITHER is
upstream-xfail'd. 2825 carries clip-watch 23pt (port clips outside
viewport — check whether that's a port defect independent of the
oracle state).

## Task
1. Read upstream test bodies (test_1581, test_2825, tests/ for 1367 if
   relevant) — what do they assert?
2. Inputs verification per the A4 playbook (2796 dump recipe as
   needed): does the port reach the same stage with the same inputs and
   survive because it is MORE correct (e.g. our rebuild_vlists fix), or
   because inputs diverge upstream?
3. Verdict per id: genuine port input defect (fix) vs oracle-bug
   acceptance (comparison page + registry entry + known-divergences
   section — extend A4 family or new class).
4. 2825 clip-watch: attribute the 23pt clip (port-side; independent?).

## Acceptance criteria
- Given the verification, then each id has fix-or-accept with evidence
  (empty ruled-out = not done); C tree reverted + oracle byte-verified.

## Rollback/Observability: N/A. Reversible.
