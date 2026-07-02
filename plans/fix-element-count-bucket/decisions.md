<!-- SPDX-License-Identifier: EPL-2.0 -->
# Decisions (approved 2026-07-02)

1. **D1 per-id pipelines.** Six independent causes; no global gate;
   per-id diagnosis journaled before that id's fix.
2. **D2 faithful C at origin.**
3. **D3 bounded-fix per id.** Mechanism is the guaranteed deliverable;
   deep → disposition + tracked. No silent partials.
4. **D4 oracle-broken protocol (1581, 2825).** Upstream test bodies
   first; inputs verification at C's failing stage; ratified policy:
   genuine port input defects get fixed even if outputs then track C's
   broken state; otherwise accept with evidence (comparison page,
   registry entry, known-divergences section).
5. **D5 decorate = feature port** (C emit.c decorate branch), golden
   test, not a defect hunt.

Rollback: Reversible (all tasks).
