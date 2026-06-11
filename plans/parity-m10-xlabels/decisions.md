# Architecture Decisions (pre-made, locked — approved by Scott 2026-06-11)

| ID | Decision |
|----|----------|
| AD1 | Module location: `src/label/` mirroring C `lib/label/` (rectangle.ts, node.ts, split-q.ts, index.ts, xlabels.ts). Matches the CLAUDE.md source map and prior mission convention. |
| AD2 | C's `EdgeLabelsDone` process global (input.c:711 reset, dotsplines.c:471 set, postproc.c:424 read) becomes a per-layout field `g.root.info.edgeLabelsDone`, reset at layout start. A module global would break concurrent renders in a browser library; per-layout semantics are identical. |
| AD3 | R-tree constants kept exactly: NUMDIMS=2, NODECARD=64, XLXDENOM=8, XLYDENOM=2, quadratic splitter only. Placement output must be deterministically identical to C. |
| AD4 | The Hilbert-code dict (`dtopen(&Hdisc, Dtobag)`, xlabels.c:47) reuses the ported `src/cdt` DtSplay if it reproduces Dtobag ordered-duplicate iteration; otherwise extend src/cdt minimally and faithfully (journaled push-forward). Iteration order feeds placement order — load-bearing; never substitute an ad-hoc sort without proving order equivalence. |
| AD5 | (Carried from mission 9.) Promotion: append-only manifest entries with provenance descriptions; never modify existing refs/manifest entries/TOLERANCES; refs generated only by the installed graphviz 15.0.0 binary; no silent re-quarantine. |

## Operational readiness (Phase 4, confirmed)

- Observability: N/A — library; golden suite + per-task gates are the
  functional SLI. Rollback: **Reversible** (git revert, one commit per
  task, no migrations). Scalability: placeLabels runs only when unset
  external labels exist; the addXLabels head guard returns early on the
  default path (66-golden byte-stability is the proof obligation, T5).
  Backwards compat: none broken; head/tail/xlabel graphs gain correct
  output.
