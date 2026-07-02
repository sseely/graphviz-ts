<!-- SPDX-License-Identifier: EPL-2.0 -->
# Decisions (approved 2026-07-02)

1. **D1 hypothesis-discriminating diagnosis.** Trace every
   tail_port/head_port write with call-site tags on both sides;
   attribute each wrong value to its exact write before fixing.
2. **D2 faithful semantics.** C copies port STRUCTS by value at every
   assignment (sameport.c, beginpath persist); that semantic is the
   spec for the port's object model.
3. **D3 evidence-scoped fixes.** Fix only implicated sites; journal
   other sharing sites as observations (they may be load-bearing).
4. **D4 no silent partials.** All 4 edge groups accounted for:
   fixed, or classified with evidence + comparison page.

Rollback: Reversible (all tasks).
