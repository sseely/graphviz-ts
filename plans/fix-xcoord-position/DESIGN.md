# Design: Text-measurement architecture (decouple layout rules from font metrics)

**Status:** Proposed (2026-06-24). Supersedes the original "fix-xcoord-position"
framing — investigation proved the x-coord divergence is a *font-measurement*
issue, not a layout-rules bug. (Dir name predates that finding.)

**Author:** layout-engine work, graphviz-ts.

---

## 1. Context & problem

`concentrate`/b69-class graphs diverge from native `dot` by ~1pt on a few node
x-coordinates, which a `routeSplines` pinch-box threshold amplifies into ~48pt
spline deltas. A full backward trace (mincross order → x-network-simplex →
node `lw`/`rw` → label width → text measurement) localized the root cause to a
**single layer: text width measurement.** Specifically, native `dot` measures
text with the platform font stack (on the reference Mac: Pango → HarfBuzz →
CoreText, "Times New Roman"), which applies **hinting + kerning**, while the
port's `LutTextMeasurer` applies hinting but **no kerning**. Kern-pair labels
(`WA`, `AW`, …) therefore measure ~2pt wider in the port → wider nodes →
shifted x-coords.

Two facts make this an architecture question rather than a bug fix:

1. **Native `dot`'s own output is platform/font-dependent.** Its text metrics
   come from whatever font the host resolves and whatever shaper the host uses.
   The current golden corpus is effectively pinned to one machine (macOS
   CoreText). graphviz is *not* reproducible across platforms on text geometry.
2. **The output SVG references fonts by name** (`font-family="Times,serif"`),
   so the *renderer* (browser, viewer) lays the glyphs with its **local** font.
   For node boxes to fit their text, layout must measure with the same font the
   renderer will use — which is the host font, not a bundled stylized copy.

So the port faces a real fork: be **deterministic/portable** (bake metrics) or
be **platform-faithful** (measure with the host font). This doc resolves it by
*decoupling* the two concerns rather than choosing one globally.

## 2. Key finding (validated by spike)

The layout **rules are already faithful**; only the **metric source** differs.
Evidence (spike, 2026-06-24, all instrumentation reverted):

- A **raw-estimate** measurer in the port (`fontsize * estimate_text_width_1pt`,
  no hinting, no kerning, height `= fontsize * 1.20` — i.e. exactly graphviz's
  `textspan_lut.c` `estimate_textspan_size`) makes the port **conformant with native
  `dot` run in *headless* mode** (a `GVBINDIR` with no textlayout plugin →
  `estimate_textspan_size`):
  - b69-min: **max node delta 0.00**.
  - 20/24 random corpus graphs: **exact**. Non-matches: `Latin1`/`Symbol`
    (non-ASCII / Symbol-font charset = measurement layer), `Petersen` (138pt but
    **pre-existing**, font-independent), `KW91` (0.93pt sub-pixel).
- `node-canvas` (Cairo "toy" text API) applies kerning but **cannot hint**
  (no `hint_metrics` control), and uses a different shaper than the Pango oracle
  → it does **not** match native dot and *regresses* currently-matching labels.
- `LutTextMeasurer` (hinted, un-kerned) matches the *pango* oracle minus kerning;
  it does **not** match the *headless* (raw) oracle.

Conclusion: text measurement is a cleanly swappable layer beneath the same
sizing rules. We can validate the rules against a deterministic, kern-free
reference (headless graphviz) and treat hinting/kerning/shaping as a separate,
swappable, separately-tested concern.

## 3. Goals / non-goals

**Goals**
- A clear, public way to choose the text measurer per runtime/use.
- A **deterministic, cross-platform** test path that validates layout *rules*
  with a clean conformant pass/fail signal (no font noise).
- A **platform-faithful** production path (real host font incl. kerning &
  ligatures) so node boxes fit the text the viewer renders.
- A measurement-fidelity test path that is reproducible on Mac/Windows/Linux.

**Non-goals**
- Byte-matching macOS native dot's *kerned* geometry in the cross-platform CI
  layout corpus (that target is platform-specific; it moves to targeted tests).
- Bundling a font rasterizer into the browser/runtime build.
- Fixing `Petersen` and other pre-existing, font-independent divergences (out of
  scope; tracked separately).

## 4. Design

### 4.1 The seam (already exists)
`TextMeasurer` interface (`src/common/textmeasure.ts`) with `measure(text,
fontname, fontsize, flags) → { w, h }`. Injected via `GvcContext.textMeasurer`
and consumed by `make-label.ts` (`measurer.measure(...)`), HTML-table layout,
and graph/edge labels. **All node/label sizing already routes through this
interface** — no sizing code changes are required to swap metrics.

### 4.2 Three measurer roles

| Role | Implementation | Hinting | Kerning/shaping | Matches | Used for |
|------|----------------|---------|-----------------|---------|----------|
| **Reference** | `EstimateTextMeasurer` (raw `estimate_text_width_1pt`, h=`fontsize*1.20`) | no | no | graphviz **headless** | layout-rules corpus; deterministic Node fallback |
| **System** | `CanvasTextMeasurer` (browser canvas) / node-canvas-backed | host-defined | yes (host shaper) | the host renderer | **production** |
| **Bundled** | conjured from a committed font via JS shaper (fontkit / harfbuzzjs) | configurable | yes (font GPOS) | the bundled font | **measurement** unit tests |

Notes:
- The current `LutTextMeasurer` (hinted, un-kerned) is a *fourth*, halfway
  variant calibrated to the pango oracle. Under this design it is **retired or
  demoted** to "deterministic-but-approximate Node default" — it matches neither
  the headless reference nor the host faithfully. Decision in §7.
- "Reference" = the port's `estimate_text_width_1pt` *without* the
  `freetypeHintedWidth` per-char px rounding. The function already exists.

### 4.3 Public measurer selection API

```ts
// explicit override wins everywhere
setTextMeasurer(m: TextMeasurer | undefined): void;   // undefined → auto

// auto-resolution (when none set), in order:
//   1. browser (typeof document !== 'undefined') → CanvasTextMeasurer(browser 2d ctx)
//   2. node + optional 'canvas' present          → node-canvas system measurer
//   3. fallback                                   → EstimateTextMeasurer (deterministic)
```

- `node-canvas` is loaded **lazily and optionally** (dynamic import), so browser
  bundles never pull the native dep, and Node without `canvas` still works
  (falls back to the deterministic estimate).
- Tests set the measurer explicitly: reference-estimate for the rules corpus,
  bundled-font for measurement tests.

## 5. Testing strategy (the decoupling)

### 5.1 Layout-rules corpus — deterministic, cross-platform
- **Oracle:** native `dot` in **headless** mode. Recipe (validated):
  ```
  mkdir ghl; cp libgvplugin_core.* libgvplugin_dot_layout.* ghl/
  GVBINDIR=ghl dot -c            # regenerates config with no textlayout plugin
  GVBINDIR=ghl dot -Tsvg g.gv    # → estimate_textspan_size (raw, no kern/hint)
  ```
- **Port:** `EstimateTextMeasurer`.
- **Result:** conformant, font-stack-independent → identical on Mac/Windows/Linux.
- **Action:** regenerate the corpus goldens once in headless mode. This is a
  one-time baseline change; afterwards the rules corpus is a clean pass/fail
  signal with zero font noise.

### 5.2 Measurement / font-fidelity — targeted, bundled, cross-platform
- Commit a small set of **metric-compatible, open-license** reference fonts
  (e.g. Liberation/Tinos/Cousine, Nimbus, DejaVu) covering the corpus families
  (Helvetica, Times, Courier, Palatino, Symbol…).
- At test time, **conjure** width/kern/shaping tables from the *bundled* fonts
  via a pure-JS shaper (fontkit for kern/GPOS; harfbuzzjs for full shaping incl.
  ligatures). Bundled font + bundled JS → identical tables everywhere.
- Unit tests assert: conjured advances/kern/ligatures match the font's own
  tables; covers `WA` kerning, `<=`/`!=` ligatures, and Latin1/Symbol charsets.

### 5.3 Production — platform-faithful
- Browser: existing `CanvasTextMeasurer` (browser canvas) — measures with the
  same local font the browser renders the SVG with (the consistency argument).
- Node: node-canvas system measurer (host font) when present; deterministic
  `EstimateTextMeasurer` otherwise.

## 6. Consequences

**Easier**
- Layout-rules regressions become unambiguous (conformant, no font noise).
- Cross-platform CI: the rules corpus passes identically everywhere.
- Font fidelity is isolated and individually debuggable.
- Production output fits the renderer's font (boxes match text).

**Harder / costs**
- One-time **golden regeneration** in headless mode (whole corpus).
- New (dev/test-only) deps: a JS shaper (fontkit/harfbuzzjs) + bundled fonts.
- Two production code paths (browser canvas vs node-canvas) — already the case.
- `node-canvas` is a native dep for Node production faithfulness (already a dep).

**Reversible?** Yes. The seam already exists; this is measurer wiring + test
re-baselining. No data-model or public-render-API change beyond the additive
`setTextMeasurer`.

## 7. Open decisions

1. **Retire vs keep `LutTextMeasurer`.** It matches neither reference nor host
   exactly. Options: (a) retire; (b) keep as the Node default when node-canvas
   is absent (hinted-but-unkerned approximation). Recommendation: **demote** to
   an internal fallback, default Node production to node-canvas, default
   tests/headless-fallback to `EstimateTextMeasurer`.
2. **Node production default when `canvas` is absent.** `EstimateTextMeasurer`
   (deterministic, approximate) vs hard-require canvas. Recommendation:
   `EstimateTextMeasurer` fallback + a one-time warning.
3. **Reference font set & licensing** for the bundled measurement tests.
4. **Corpus re-baseline scope** — regenerate all goldens headless, or run rules
   and font corpora side by side during migration.

## 8. Alternatives considered

- **node-canvas everywhere (Node).** Rejected as the *test* oracle: un-hinted
  (can't match the macOS goldens), Cairo-toy shaper ≠ Pango, regressed
  currently-matching labels, and blurs match/no-match on every text label
  (loses the corpus signal). Retained as a *production* measurer.
- **Bake a kern table into the hinted LUT.** Prototype converged b69 to
  ~0.03–0.9pt (validates kerning as the cause) but: needs per-family tables for
  ~8 fonts; only matches one platform's CoreText kerning; entangles kerning into
  every layout golden. Superseded by the decoupling (kerning → targeted tests).
- **Keep deterministic baked metrics only.** Can never match the host font the
  viewer renders with (box/text mismatch); contradicts the platform-faithful
  production goal.

## 9. Migration plan (phases → mission brief)

1. **Reference measurer + headless rules corpus.** Add `EstimateTextMeasurer`;
   regenerate goldens headless; switch the rules survey to it. Gate: conformant
   on the rules corpus (modulo pre-existing, font-independent divergences like
   Petersen, which are documented, not introduced here).
2. **Public `setTextMeasurer` + auto-resolution chain** (browser → node-canvas →
   estimate). Lazy/optional node-canvas load.
3. **Bundled-font measurement tests.** Add reference fonts + JS shaper; unit
   tests for kerning, ligatures, charset (covers Latin1/Symbol).
4. **Production wiring + docs.** Node uses node-canvas; document the contract
   (rules = deterministic; production = host-faithful).

## Appendix — evidence pointers
- Root-cause trace & repro: `plans/fix-xcoord-position/repro/` and the
  conversation decision log.
- Faithfulness facts: native dot `estimate_textspan_size` is raw per-char (no
  hint/kern, `units_per_em=2048`); oracle used Pango/CoreText (hinted+kerned);
  port `LutTextMeasurer` = `freetypeHintedWidth` (hinted, un-kerned).
- Spike numbers: raw-estimate port == headless dot conformant (b69-min 0.00;
  20/24 sample exact). node-canvas kerned-but-unhinted, no hint control.
