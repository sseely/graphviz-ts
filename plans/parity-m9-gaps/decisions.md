# Architecture Decisions (pre-made, locked — approved by Scott 2026-06-11)

| ID | Decision |
|----|----------|
| AD1 | The postprocess port lives in `src/common/postproc.ts`, mirroring C `lib/common/postproc.c` (gv_postprocess, translate_drawing, map_point, translate_bb). Wired into the dot pipeline now; shared location for other engines later. |
| AD2 | Integration with the port's existing TB normalization: prefer **faithful replacement** — the ported gv_postprocess becomes the one translation path for all rankdir values, the existing ad-hoc TB translation removed. **Hard gate:** all pre-existing goldens stay byte-identical (self-baseline diff of port output before/after). If replacement perturbs TB output, fall back to conditional application (rotate/offset only when rankdir ≠ TB) with a decision-journal entry. T4 recon locates the existing TB translation first. |
| AD3 | rankdir=RL is in scope. No quarantined golden exists for RL → T8 creates `dot-rankdir-rl.dot` and generates its ref with the installed C graphviz 15.0.0 binary (`dot -Tsvg`), same provenance rule as post-parity D2. |
| AD4 | twopi/circo self-loop debugging uses the full-precision C-oracle technique (.agent-notes/fdp-fma-oracle-2026-06.md): a small C probe linked against Homebrew graphviz libs printing positions/control points at %.17g, bisecting where the port diverges. Probes live in `.probes/` (untracked). Never guard-bisect. |
| AD5 | Quarantine promotion: when a quarantined golden passes, move input+ref into test/golden/inputs|refs/, APPEND a manifest entry recording the generating command ("ref: graphviz 15.0.0 dot -K<engine> -Tsvg"), delete the quarantine copies in the same commit. Tolerance+portReference pins allowed per the established M8 pattern. A golden whose cluster is fixed but which still fails beyond pinning → STOP (no silent re-quarantine). |
| AD6 | Tighten `edge.info.head_label` / `tail_label` from `unknown` to the existing label type returned by src/common/make-label.ts. No new label abstraction. |
| AD7 | Branch `feature/parity-m9-gaps` off `feature/post-parity`; merge back into `feature/post-parity` with a merge commit. The paused post-parity mission resumes afterward. |

## Operational readiness (Phase 4, confirmed)

- Observability: N/A — library; the golden suite + per-task gates are the
  functional SLI. Rollback: **Reversible** (git revert, one commit per
  task). Scalability: postprocess adds one O(V+E) transform per layout,
  same as C. Backwards compat: public API unchanged; SVG changes only
  for graphs using the fixed features; AD2 byte-identity gate protects
  default-path output.
