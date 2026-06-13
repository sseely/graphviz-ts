# Architecture Decisions (pre-made, locked — approved by Scott 2026-06-12)

| ID | Decision |
|----|----------|
| AD1 | One unified label entry mirroring C `labels.c:make_label(obj, str, kind)` — branches on html internally; all 7 creation sites call it once. Restores the C function boundary (the port's makeLabel/makeHtmlLabel split is the deviation). Centralizes C's html-parse-failure fallback — match C exactly and cite it. |
| AD2 | Font flags reach measurement via an optional flags/variant parameter on `TextMeasurer.measure` (all three implementations). LUT picks the existing bold/italic/boldItalic arrays; canvas maps to font shorthand; freetype-hinted maps to variant. NO fontname mangling (no C analogue). Mirrors textfont_t.flags → estimate_textspan_size. |
| AD3 | `<IMG>` dimensions come from a caller-injected ImageSizer (name → {w,h}); absent → C's missing-image behavior exactly (warning + zero size). Sanctioned by CLAUDE.md's FILE* rule. Full IMG sizing/emission ports against the interface. |
| AD4 | Gradient paint: GRADIENTANGLE and two-color BGCOLOR parse+store (C-complete data model); `<linearGradient>` emission DEFERRED — depends on the unported gradient-fills subsystem (C svg_gradstyle; node/cluster fills need it too). Solid BGCOLOR fill fully in scope. |
| AD5 | Golden tolerance target: `deterministic`. The 0.4pt divergence on the live node-html path is hypothesized downstream of the flag bug (regular-vs-bold measurement shifting centered x). T9 re-probes after the fix; residual metric-model divergence = STOP for Scott's tolerance call. Any new tolerance class is append-only and needs sign-off. |
| AD6 | `html_port`: parse + store the PORT attribute (data model C-complete); attachment semantics deferred to the parity-edge-ports mission (ports are unported in the dot engine — parser discards them at builder.ts:168). |
| AD-C1 | (Carried M9–M11.) Append-only manifest entries with provenance descriptions; never modify existing refs/manifest entries/TOLERANCES; no silent re-quarantine; refs from installed graphviz 15.0.0 only. |

## Locked constraints (not decisions)

- C function boundaries + @see cites per ported block (CLAUDE.md).
- YAGNI does not apply: the C source defines completeness; omissions
  are bugs. The only exceptions are AD4/AD6 dependency deferrals.
- Hot-loop GC pressure: the font-flag stack and html sizing run per
  label — no per-span garbage in measurement loops (CLAUDE.md memory
  rules); quality-bar line, not a gate.

## Operational readiness (Phase 4, confirmed)

Observability: N/A — library; gate suite is the functional SLI (tsc
clean, vitest 0 failed, byte-stability probe, C-oracle comparison).
Rollback: **Reversible** (git revert, one commit per task, no
migrations; ImageSizer + measurer param are optional/additive).
Scalability: N/A beyond the hot-loop constraint above. Backwards
compat: no breaking changes; SVG output gains content (convergence);
TextMeasurer param optional; manifest append-only.
