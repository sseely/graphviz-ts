# Architecture Decisions (pre-made, locked — approved by Scott 2026-06-12)

| ID | Decision |
|----|----------|
| D1 | Root graph-label creation call lands in `dotGraphInit` (src/layout/dot/init.ts) — the port's input.c:graph_init equivalent (same site C uses, input.c:719; same precedent as M10's AD2 edgeLabelsDone reset). |
| D2 | New creation paths are plain-text only via `makeLabel` (M9 head/tail precedent; the live emitter already skips `lp.html` per AD-2). HTML label support is a SEPARATE future mission — T8 writes its scoping doc. Document the limitation with a comment at each creation site. |
| D3 | The dead `src/common/emit*.ts` family (9 modules + emit.test.ts; `emit-types.ts` stays) is deleted in this mission (T7) after a symbol-level reachability audit: LSP findReferences / Serena find_referencing_symbols on EVERY export, plus ast-grep structural sweeps for dynamic patterns. Any live-needed logic is folded into the live path first. A live reference found = STOP. |
| D4 | 5 new goldens, dot engine, deterministic tolerance: dot-node-xlabel, dot-edge-label, dot-edge-xlabel, dot-graph-label, dot-labels-combined. Refs from installed graphviz 15.0.0 only. Manifest 67 → 72. |
| AD5 | (Carried from M9/M10.) Append-only manifest entries with provenance descriptions; never modify existing refs/manifest entries/TOLERANCES; no silent re-quarantine. |

## Locked constraints (not decisions)

- `has_labels` bit set/read graph parity: C sets on `agraphof(...)`
  (containing graph) and readers vary between `g` and `g->root` per
  site — every ported set/read must cite and match its C counterpart.
- gvPostprocess statement order: place_root_label is called at the
  postproc.c:676 point; preserve C order relative to addXLabels
  (postproc.c:616) and translation.

## Operational readiness (Phase 4, confirmed)

Observability: N/A — library; golden suite + per-task gates are the
functional SLI (tsc clean, vitest 0 failed, byte-stability probe).
Rollback: **Reversible** (git revert, one commit per task, no
migrations; emit-family deletion recoverable from git history).
Scalability: creation is attribute-gated like C; dormant machinery
activates only via has_labels bits. Backwards compat: no API change;
SVG output gains text elements (convergence toward C, not a break).
