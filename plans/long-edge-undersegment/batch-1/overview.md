<!-- SPDX-License-Identifier: EPL-2.0 -->

# Batch 1 — Localize the under-segmentation (spike)

The mission's crux: pin WHERE the long-edge spline loses a bezier piece, given
the routing order already matches C. No production-code change —
instrumentation + analysis only. Output is the `#d-fixsite` decision, the filled
T2 spec, and the D5 per-row classification of the rankdir_dot rows.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| S1 | Instrument C `routesplines_`/`Proutespline` + the port for `sleep--runmem` on p3; diff box corridor, `Pshortestpath` input polyline, endpoint slopes, piece count; pin the first differing field. Classify each rankdir_dot row (D5). | (executor inline; no subagent) | `plans/.../decisions.md` (#d-fixsite), `plans/.../batch-2/T2-fix.md`, `decision-journal.md`, `comparisons/*` (rankdir classification), scratch under `.probes/` | — | [ ] |

Gate after batch: `#d-fixsite` filled with the instrumented C-vs-port diff; T2's
write-set + approach + acceptance concrete; rankdir_dot rows classified (D5); no
production source changed (`git diff --name-only main` empty); C tree reverted
clean; `.probes/` removed. If the diff implicates the fitter (`route.ts`),
**stop** — premise wrong, re-scope with the user.
