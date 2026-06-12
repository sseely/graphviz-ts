# M12 html-label parity: findings with future relevance

## Observation: C size_html_txt has a simple/non-simple vertical model
- **Context**: T9 oracle verification — a 0.45pt html baseline divergence
  that looked like a font-metric problem (bold runs).
- **Finding**: C switches line models whenever a text block has font
  flags, >1 run per line, or mixed faces/sizes (htmltable.c:946-986):
  lfsize₀ = mxfsize − maxoffset; later lfsizeᵢ = mxfsize + ysize −
  curbline − maxoffset; lsize = raw font size (not metric height); the
  renderer adds a constant 1pt yoffset_centerline (emit_htextspans:
  177-180). The binary's maxoffset = 0.05 × fontsize — the same
  constant the plain-text port locked. Ported in htmltable.ts
  (HtmlSizeEnv, sizeTextContent) + htmltable-pos.ts
  (placeSimpleRuns/placeComplexRuns).
- **Impact**: Baseline divergences that scale with "decoration
  complexity" rather than font size are branch divergences, not metric
  divergences. Check for unported C branches before invoking the
  metric-model stop rule.
- **Confidence**: High (algebra closes exactly; 10 goldens at
  deterministic).

## Observation: pre-existing divergences catalogued during M12 (NOT fixed)
- **Context**: T9 exclusion list.
- **Finding**: (1) shape=plaintext nodes draw a node-outline polygon —
  poly-gencode.ts never ported poly_gencode's peripheries loop
  (p_plaintext has peripheries=0 → C draws nothing); affects plain and
  html labels; zero golden coverage. (2) Non-14pt fontsize diverges in
  line height for PLAIN text too (fs=20 → svg height 53 vs C 51) — the
  LUT/freetype height model is only validated at 14pt; no golden uses
  another size. (3) Whole-node URL/tooltip anchors (node attrs) are
  unported; html cell/table anchors are done. (4) htmltable-lex
  parseAttrs re-matches words inside quoted attr values as phantom
  empty attrs (deviates from htmllex.c doAttrs; harmless today).
- **Impact**: Each is a candidate one-mission/one-line fix; (1) and (2)
  block goldens for plaintext-shaped and non-14pt inputs respectively.
- **Confidence**: High (stash-verified at pre-mission HEAD; C oracle).

## Observation: job.obj is always null in the live render path
- **Context**: T6 BGCOLOR fills emitted fill="none".
- **Finding**: No production code calls RenderJob.pushObj — every
  emitStyle call falls into the obj===null branch (fill="none"
  stroke="black"). All C gvrender_set_fillcolor/set_pencolor-style
  writes to job.obj are silent no-ops. The port pattern that works:
  scoped push/pop of a module-reused ObjState (withHtmlPaint in
  htmltable-emit-fill.ts). Node fillcolor/style=filled is also
  unported for the same reason (fill="none" for style=filled nodes).
- **Impact**: Any future fill/pen work must either use withHtmlPaint
  or finally wire obj-state into the walk; node fills are a known gap.
- **Confidence**: High (grep + probe).

## Observation: known-issues follow-up (fix/m12-known-issues, 2026-06-12)
- **Context**: Post-M12 session fixing the catalogued pre-existing items.
- **Finding**: All five resolved + two bonus gaps found and fixed:
  (1) peripheries — full port: ring vertices (C layout vertices[i+j*sides],
  pre-growth bb now exposed as PolySizeResult.baseW/H + ND base_width),
  draw loop, peripheries=0 suppression, poly_inside outermost-ring clip;
  doublecircle/doubleoctagon/tripleoctagon/peripheries=N all C-exact.
  (2) Line heights — C model is ceil(1825/2048·px)+ceil(443/2048·px)
  hinted px (fitted exactly at 15 sizes); replaced the 14pt-calibrated
  linear FREETYPE_LINE_SPACING in the measurer; freetypeAscent rounds
  UP (FT_PIX_CEIL — round vs ceil diverge at fs=12 etc).
  (3) BONUS: make_simple_label was never ported — multiline plain labels
  emitted one <text> with raw newlines; now split on \n/\l/\r with
  per-line justification spans.
  (4) Node anchors + strdup_and_subst_obj0 (\G\N\E\T\H\L) + interpretCRNL;
  the DOT grammar now keeps the six substitution escapes verbatim
  (scan.l behavior) — regenerate src/parser/dot.js via
  `npx peggy --format es -o src/parser/dot.js src/parser/dot.pegjs`.
  (5) parseAttrs phantom-attrs fixed; bare/unquoted attrs now throw
  (expat well-formedness → C fallback). (6) IMG SCALE falls back to the
  node imagescale attr via the per-object emit env.
- **Finding**: Remaining true metric tail: some strings measure ±1px vs
  C (edge label "A to B" graph bb 72 vs 71pt; text positions identical)
  — per-char LUT px rounding vs pango whole-string shaping. Needs real
  shaping data; not fixable in the LUT model.
- **Finding**: Parser still cooks \t→tab and \X→X (scan.l keeps both
  verbatim; C handles them at make_simple_label/subst time). Escaped
  backslash before a subst escape ("\\\\N") therefore substitutes where
  C keeps it literal. Niche; full escape parity would need the lexer to
  stop cooking and every text consumer to process escapes like C.
- **Confidence**: High (all fixes verified case-by-case against dot
  15.0.0; 82 goldens byte-identical throughout; suite 1449 tests).
