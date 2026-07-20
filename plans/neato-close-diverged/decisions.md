<!-- SPDX-License-Identifier: EPL-2.0 -->

# Architecture Decisions (locked)

## D1 — Execution order & regression-gate breadth {#order}

- **Decision:** B1 (node-placement/packing) fixed and re-swept FIRST, because
  node positions cascade into edges (B2), labels (B4), and arrowheads (B5).
  Then residual B3/B4/B5+B2 in Batch 3.
- **Decision:** the 0-regression gate is **broad** — neato is the target metric,
  but every batch also sweeps **dot + circo + twopi + osage + patchwork** and
  must hold them at 0 regressions BY ID. Rationale: B1 edits shared
  `src/layout/pack/*` and neato/init sizing that dot also consumes.
- **Consequence:** slower per-batch verification; protects the `plantuml-ts`
  consumer (which depends on dot fidelity). Regressions keyed by id, never by
  count (a single oracle flake changes counts silently).

## D2 — Definition of "closed" {#closed}

- **Decision:** an item is closed when it either passes at 0.5pt OR is
  root-caused and classified as one of: `fix-landed`, `accept-drift` (A1),
  `oracle-bug` (A4), or `cascade-of-known-parent`. Accept-class items get a
  `docs/known-divergences.md` entry + a journal line.
- **Rejected:** "literal 0 diverged" — would force unfaithful edits on genuine
  A1/A4 items, violating the "C source is sacred" rule.
- **Consequence:** bounded, honest completion consistent with the existing
  A1–A9 accepted-divergence discipline.

## D3 — Scope: full close-up {#scope}

- **Decision:** this mission covers B1 + re-sweep + triage of every residual
  bucket to the D2 bar. Multi-batch; each residual bucket is its own task.
- **Consequence:** longer horizon; the D2 accept-class escape valve keeps it
  bounded. The 7 oracle-error ids are excluded (native binary fails/timeouts —
  not port defects).

## D4 — Rollback: Reversible

Every change is `git revert`-able; no data migration, no persisted state.
`known-divergences.md` entries are docs. No irreversible steps — no user
acknowledgement required.

## D5 — Parallelism only via worktree isolation

The sweep reads *live* `src/`, so parallel agents editing `src/` against a shared
tree is unsafe. Batch 3 residual tasks touch non-overlapping files
(cluster path / label module / spline module) and run in **separate git
worktrees** so each sweeps its own isolated tree. Batches 1, 2, 4 are single
sequential tasks. (Matches the "diagnosis agents MUST isolation:worktree" lesson.)

## D6 — `plans/` is committed here

Project CLAUDE.md: "Keep the plans/ contents — they are the archaeology of this
effort." This brief is committed; only `.claude/settings.*` stay gitignored.
