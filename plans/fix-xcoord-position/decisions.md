# Architecture decisions — text-measurement architecture

## ADR-1 — Reference measurer = raw estimate (matches headless graphviz)
- **Context:** the port's default `LutTextMeasurer` hints (`freetypeHintedWidth`,
  per-char 96dpi px rounding) to approximate the pango oracle, so it matches
  neither the pango oracle (lacks kerning) nor headless dot (which is un-hinted).
- **Decision:** add `EstimateTextMeasurer` = `fontsize * estimate_text_width_1pt`
  (the existing raw, un-hinted, un-kerned function) with height `fontsize*1.20`
  (graphviz `LINESPACING`). This *is* graphviz `estimate_textspan_size`.
- **Consequences:** byte-matches native dot run headless (spike: b69-min 0.00,
  20/24 sample exact) → a deterministic, font-stack-independent reference.

## ADR-2 — Decouple layout rules from font metrics
- **Context:** b69's divergence is entirely font measurement; the sizing rules
  (margins, ellipse fit, mincross, x-NS) are faithful.
- **Decision:** validate **rules** with the reference measurer vs **headless**
  goldens (deterministic, cross-platform). Move **hinting/kerning/shaping/charset**
  fidelity to targeted unit tests against **bundled** fonts. Production uses the
  **system** measurer (host font).
- **Consequences:** the layout corpus becomes a clean byte-exact pass/fail signal
  with no font noise; font fidelity is isolated and individually debuggable.

## ADR-3 — Side-by-side corpus migration, then cut over (NOT big-bang)
- **Context:** switching the survey oracle from pango goldens to headless goldens
  is a baseline change for the whole corpus.
- **Decision:** stand up the headless rules corpus **alongside** the existing
  corpus; keep the existing survey green throughout; cut over (retire the old
  corpus) only in Batch 3 once the rules corpus is proven.
- **Consequences:** lower risk, easy bisect, transient duplication. The
  "existing survey 0 regressions" gate holds until cutover.

## ADR-4 — Demote the hinted LutTextMeasurer to an internal fallback
- **Context:** the hinted LUT matches neither reference nor host exactly.
- **Decision:** keep `LutTextMeasurer` as a **non-default internal fallback** only.
  Default tests → `EstimateTextMeasurer`; default Node production → system canvas
  (ADR-6); default browser → browser canvas. Do **not** delete it (it is the
  hinted-deterministic option and underpins existing pre-cutover goldens).
- **Consequences:** no measurer is silently "halfway"; existing goldens keep
  working until cutover; reversible.

## ADR-5 — Node fallback = EstimateTextMeasurer + install advice
- **Context:** Node production should be host-faithful (node-canvas), but the
  `canvas` dep may be absent (e.g. zero-dep usage).
- **Decision:** when no canvas is available in Node, fall back to
  `EstimateTextMeasurer` (deterministic, approximate) and emit a **one-time
  warning** that metrics are approximate **and advises installing the `canvas`
  package** for host-faithful measurement. Never hard-fail.
- **Consequences:** zero-dep Node still works; users are told how to get fidelity.

## ADR-6 — Production = system canvas (host font)
- **Context:** the SVG renders with the viewer's local font; layout boxes must fit
  that font (DESIGN.md §1). node-canvas (Node) and browser canvas both measure the
  host font with real kerning/shaping (incl. ligatures).
- **Decision:** production default = system canvas measurer (browser: browser
  canvas; Node: node-canvas when present). Load node-canvas **lazily/optionally**
  so browser bundles never pull the native dep.
- **Consequences:** host-faithful production; two production paths (already true);
  a native optional dep for Node fidelity.

## ADR-7 — Public, settable measurer with auto-resolution
- **Context:** consumers and tests need to choose the measurer.
- **Decision:** add `setTextMeasurer(m | undefined)`; when unset, auto-resolve
  browser-canvas → node-canvas → `EstimateTextMeasurer`. Explicit set wins.
- **Consequences:** tests pin the measurer (reference for rules; bundled for
  measurement); advanced consumers override; default behavior is sensible.
