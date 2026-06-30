<!-- SPDX-License-Identifier: EPL-2.0 -->
# Architecture decisions

## AD-1 — Instrument before fixing (diagnosis mode)
- **Context:** The symptom (6 dropped edges) is confirmed, but the mechanism is
  not yet pinned to a line. The candidates span `conc.ts` (virtual-node merge,
  `rebuild_vlists` truncation) and the concentrated-chain emission path.
- **Decision:** Batch 1 instruments C's `dot_concentrate`/`class2` decisions and
  the port's, for the 6 named edges, and states the mechanism (cause, file:line,
  causal chain, ruled-out) before any fix.
- **Consequences:** No fix is written on a guess. If the cause is irreducible
  (FP/libm), STOP per the brief.

## AD-2 — Faithful port, not a dedup-key patch
- **Context:** C never deletes original edges under concentrate; it merges only
  virtual nodes (portcmp-gated) and emits every original. The port drops 6.
- **Decision:** The fix mirrors C's algorithm (conc.c / class2.c / dotsplines.c).
  Do NOT make the count "right" by adding ports to a node-pair dedup key or any
  other shortcut that diverges from C's control flow.
- **Consequences:** The change is byte-faithful to the oracle. Per the project's
  "C is sacred" rule, a passing count with a non-C mechanism is a defect.

## AD-3 — Widened write-set (cross merge→emit boundary)
- **Context:** The drop may originate in the merge (`conc.ts`/`classify.ts`) or
  surface only at emission (`edge-route.ts`/splines). The user pre-authorized a
  write-set spanning both.
- **Decision:** Authorized fix files: `conc.ts`, `classify.ts`, `edge-route.ts`,
  and the splines emission module the root cause implicates (e.g. `splines.ts`)
  — plus their colocated `*.test.ts`. The fix agent edits only the file(s) the
  Batch 1 mechanism implicates, within this set.
- **Consequences:** No mid-mission stop to widen scope across the merge→emit seam.
  Editing anything outside this set is still a STOP.

## AD-4 — Bar = conformant + 0 regressions, gated vs committed HEAD
- **Context:** Faithful target is byte/structural match; the survey gate guards
  the corpus. The on-disk `parity.json` can be pre-contaminated (observed in the
  prior mission) — gating against it can mask regressions.
- **Decision:** `graphs-b15` must reach `conformant` (153 edges, 6 named edges
  present). `rules-gate` must show 0 regressions **against the committed HEAD
  baseline** (`git show HEAD:test/corpus/parity.json`), not the on-disk file.
  Refresh the baseline only after a clean gate.
- **Consequences:** Honest checkpoint. Touching `accepted-divergences.*` only if
  a status change requires reconciliation.

## AD-5 — Reversible
- Revert the commit(s) + restore the baseline. No data/schema/API change.
