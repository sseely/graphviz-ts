<!-- SPDX-License-Identifier: EPL-2.0 -->

# Batch 3 — validation + dashboard

Final batch. Depends on all prior tasks.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T5 | Regenerate survey + dashboard, comparison pages, confirm 0 regressions + 3×-native | typescript-pro | `test/corpus/parity.json` (regen), `test/corpus/PARITY.md` (regen), `comparisons/**` (new pages) | T1, T2, T3, T4 | [x] |

## Quality gate

The mission's exit gate. See T5 for the full checklist. The mission is **not
complete** until: 0 regressions, every rescued case that lands in `diverged` has
a comparison page referenced in the decision journal (project CLAUDE.md rule),
and the final timings are logged.
