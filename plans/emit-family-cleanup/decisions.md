# Architecture Decisions

| ID | Decision |
|----|----------|
| AD1 | **emit-types.ts is kept; the nine implementation modules are deleted.** `emit-types.ts` exports `TextSpan` (consumed by 12 live source files) and the `HTML_*` bit-flag constants (consumed by `svg-helpers.ts` and `htmltable-pos.ts`). All nine implementation modules (`emit.ts`, `emit-node.ts`, `emit-edge.ts`, `emit-cluster.ts`, `emit-xdot.ts`, `emit-style.ts`, `emit-bb.ts`, `emit-coord.ts`, `emit-shape.ts`) had zero live importers and are deleted. Already executed in commit `a785a86`. |
| AD2 | **Fold-vs-delete: delete only — no folding required.** Every C behavior in the emit-family had a live-path counterpart already present in `src/gvc/device.ts` + `src/render/svg*.ts` (the golden-validated port). The family had drifted (incompatible `RenderJob` shape) and contained no unique C logic not already ported. Verified by the commit `a785a86` audit. If T1 (gate verification) surfaces a tsc error citing a deleted module, STOP and re-audit before adding any fold. |
| AD3 | **Worktree cleanup is a `git worktree remove` operation, not a source change.** The seven stale locked worktrees under `.claude/worktrees/` are at pre-deletion commit points fully subsumed by `feature/post-parity`. They are git worktrees, not branches with unique commits. Removal is safe when confirmed that `git log <worktree-branch> ^feature/post-parity` is empty. If any worktree has unique commits, DO NOT remove it — stop and report. |
| AD-C1 | (Carried from M9–M12 and parity-render-styling.) Append-only manifest entries with provenance; never modify existing refs, manifest entries, or tolerances; refs only from installed graphviz 15.0.0. |

## Locked constraints (not decisions)

- `emit-types.ts` is not touched in any task in this mission.
- The 82 goldens must remain byte-identical throughout — the live
  render path (device.ts / svg*.ts) is not modified by this mission.
- One commit per task; no WIP commits.
- The safety proof is: `tsc clean + vitest >= 1466 + 82 goldens
  byte-identical`. These three gates together constitute the
  evidence that deletion was safe. Gate failure = stop, not fix.

## Operational readiness

Observability: N/A — library; the gate suite is the functional SLI.
Rollback: **Reversible** (`git revert a785a86` restores the deleted
files instantly; worktree removal is permanent but the branches
remain). No migrations, no API contracts changed (emit-family was
never public API — it was unreachable dead code). Backwards compat:
no consumer was importing from the deleted modules (grep-verified).
