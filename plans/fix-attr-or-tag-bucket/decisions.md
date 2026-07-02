<!-- SPDX-License-Identifier: EPL-2.0 -->
# Decisions (approved 2026-07-02)

1. **D1 gated diagnosis.** Per-id mechanisms before fixes; gate report.
2. **D2 faithful port at origin.** C is the spec; instrument C first.
3. **D3 b15 bounded-fix rule.** Deliverable = pinned mechanism; fix only
   if ≤ ~2 files + faithful + gate-clean; else disposition + tracked.
   Rationale: deep classes (x-NS selection, maze tie-breaks) burn
   missions when forced; artifacts seed the follow-up instead.
4. **D4 hyphen escaping at xml-escape.ts.** Mirror C's per-context
   tables from gvrender_core_svg.c. Expected XML-equivalent (no verdict
   moves — hard stop if violated). Golden byte-assertion syncs in the
   same commit.

Rollback: Reversible (all tasks).
