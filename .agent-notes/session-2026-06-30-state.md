<!-- SPDX-License-Identifier: EPL-2.0 -->
# Session state — 2026-06-30 (resume notes)

Consolidated state for picking this back up (Fable expected back online ~2026-07-01;
verify it's live before routing autonomous runs to it — see memory
`fable-disabled-use-opus`).

## Branches (NOT merged; user batches branch cleanup)

### `fix/graphs-b15` — b15 concentrate fix DEFERRED
- Source is REVERTED to `main` (b15 stays a documented concentrate edge-count
  divergence: port 147 edges vs oracle 153). `git diff main -- src/` is empty.
- Full diagnosis preserved: `plans/fix-graphs-b15/` (README marked DEFERRED) +
  `.agent-notes/graphs-b15-concentrate-drop.md` (T1 root cause + T2-v1 REGRESSION).
- Tip commit `a124fed` (revert + deferral summary).
- **Why deferred:** b15 drops 6 concentrate edges because splines collection skips
  the VIRTUAL splineMerge merge-representative. Two dispatch-guard fixes (T2-v1
  `out.size>1`; T2-v2 `node_type!==NORMAL && splineMerge`) BOTH failed at the same
  41 edges — a boolean guard can't separate secondary-chain edges from
  routeMergedChain edges (v1 doubled beziers → maxΔ432; v2 under-routed). Real fix
  is architectural: reproduce C `dotsplines.c` collection → `edgecmp`-grouping →
  `getmainedge` dedup so each original routes EXACTLY once. Re-scope via
  `/plan-mission`. (Task #7.)

### `docs/reconcile-divergences` — A2/A1 doc reconciliation DONE
- Tip commit `315daca` (off `main`).
- `docs/known-divergences.md`: §A2 status banner (proc3d collapsed to conformant;
  FreeType-vs-estimate framing corrected; NaN mechanism flagged under re-diagnosis);
  §A1 reworded to scope + cross-platform-portability caveat.
- New `test/corpus/known-divergences-examples.test.ts` — prose-rot guard binding the
  doc's per-graph claims to live parity verdicts (would have caught proc3d).
  typecheck 0; 8/8 divergence guard tests pass.
- Evidence: `.agent-notes/a2-collapse-findings.md`.

## Key findings (memory: `a2-collapsed-proc3d-conformant`)
- **A2 largely collapsed:** proc3d now CONFORMANT (all corpus dirs). Survey runs
  BOTH sides on `estimate_textspan_size` (headless `/tmp/ghl`, no FreeType). Only
  NaN family remains.
- **NaN residual (unpinned):** 8 edges (`Target↔TThread`, `Interp↔InterpF`,
  `Event↔Target`, `AtomProperties↔NRAtom`); node centers MATCH C exactly; endpoints
  shift 6–14pt, piece counts match → edge-attachment/routing residual, NOT the
  doc's old node-x-shift. Mechanism not pinned. (Task #5.)
- **A1 uneliminable via dot posture:** force-directed engines are NEVER surveyed
  (oracle GVBINDIR = core+dot_layout only; survey forces dot both sides). A1 is a
  prospective cross-platform FP caveat, not a measured divergence. To assess →
  separate force-directed parity track; best outcome = NARROW, not eliminate.
  (Task #6.)
- **Prose-rot root cause:** proc3d was cited in doc prose but never in
  `accepted-divergences.json`, so the registry guard (`accepted-divergences.test.ts`,
  JSON-only) never covered it → silently went stale when it flipped conformant. New
  guard closes this for cited examples.

## Open tasks (see TaskList)
- #5 re-diagnose graphs-NaN mechanism (bounded diagnosis; could go deep — doc is
  already honest, not urgent).
- #6 force-directed parity track (standalone mission → `/plan-mission`).
- #7 re-scope b15 concentrate fix (edgecmp grouping rework → `/plan-mission`).

## Environment reminders
- Oracle render recipe: `GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg`.
- Port render: `GV_TEXT_MEASURER=estimate GVBINDIR=/tmp/ghl npx tsx test/corpus/render-one.ts <input> dot`.
- Gate vs COMMITTED HEAD `parity.json`, never on-disk (contamination hazard).
- Per-edge maxDelta (title-paired) is the real bar — count + title-order are NOT
  sufficient (they masked the b15 T2-v1 regression).
