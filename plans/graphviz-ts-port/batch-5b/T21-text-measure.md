# T21 — Text Measurement

## Context

The project is a faithful TypeScript 5.x port of Graphviz `lib/`, targeting
SVG output. TypeScript strict mode, Vitest, esbuild, EPL-2.0, no Node.js in
core.

`lib/common/textspan_lut.h` declares `estimate_text_width_1pt(font_name,
text, bold, italic)`. `lib/common/textspan_lut.c` implements a per-character
ASCII width lookup table for 11 font families. When a font is not found in
the table, it falls back to Times-Roman metrics plus a one-time warning.

`lib/common/textspan.c` implements `textspan_size()` which dispatches to
either Pango (unavailable in a TypeScript port) or the LUT fallback. Per
AD-10, the TypeScript port uses the LUT as the primary implementation for
server/Node/test contexts, and Canvas 2D `measureText` for browser contexts.
Both are injected via the `TextMeasurer` interface.

### Font name normalization — critical

`textspan_lut.c` normalizes font names before LUT lookup via
`font_name_equal_permissive`:

```c
static bool font_name_equal_permissive(const char *a, const char *b) {
  // lowercase both; strip all non-letter characters
  ...
}
```

The normalization is: **lowercase the entire font name, then strip all
characters that are not letters**. This means:
- `"Times New Roman"` → `"timesnewroman"` (matches the `"timesnewroman"` key)
- `"Times-Roman"` → `"timesroman"` (matches the `"timesroman"` key)
- `"Arial MT"` → `"arialmt"` (matches the `"arialmt"` key)

This normalization must be applied before every LUT lookup.

### The 11 font families (from textspan_lut.c)

The LUT contains exactly these 11 font family groups:

1. **Times** — keys: `times`, `timesroman`, `timesnewroman`, `freeserif`,
   `liberationserif`, `nimbusroman`, `texgyretermes`, `tinos`, `thorndale`
2. **Helvetica/Arial** — keys: `helvetica`, `arial`, `arialmt`, `freesans`,
   `liberationsans`, `nimbussans`, `texgyreheros`, `albatross`, `arimo`
3. **Courier** — keys: `cour`, `courier`, `couriernew`, `nimbusmono`,
   `liberationmono`, `texgyrecursor`, `cousine`, `freemono`
4. **Nunito** — key: `nunito`
5. **DejaVu Sans** — key: `dejavusans`
6. **Consolas** — keys: `consola`, `consolas`
7. **Trebuchet MS** — keys: `trebuchet ms`, `trebuchet` (after normalization:
   `trebuchetms`, `trebuchet`)
8. **Verdana** — key: `verdana`
9. **Open Sans** — key: `opensans`
10. **Georgia** — key: `georgia`
11. **Calibri** — key: `calibri`

A font name that does not match any of these groups (after normalization)
falls back to the **Times** metrics. The fallback must emit a console warning
**exactly once** per unique unrecognized font name (not once per character or
once per call). Use a `Set<string>` to track warned names.

### LUT scaling

The LUT stores character widths in `units_per_em` units at 1 pt. To get the
width at `fontSize` pt:

```
width_pt = (width_units / units_per_em) * fontSize
```

This is a linear scale — the result scales linearly with fontSize.

### Canvas 2D implementation

The `CanvasTextMeasurer` requires access to a Canvas 2D context. Because
core modules must not import DOM APIs directly, inject the canvas context via
constructor:

```typescript
export class CanvasTextMeasurer implements TextMeasurer {
  constructor(private ctx: CanvasRenderingContext2D) {}
  measure(text: string, fontname: string, fontsize: number): { w: number; h: number } {
    this.ctx.font = `${fontsize}px ${fontname}`;
    const m = this.ctx.measureText(text);
    return {
      w: m.width,
      h: fontsize,  // height approximation; match C behavior
    };
  }
}
```

The height approximation (`h = fontsize`) matches the behavior in the C code
where `textspan_size` uses the font size as the height when Pango is
unavailable.

## Task

Implement `src/common/textmeasure.ts`:

1. Export the `TextMeasurer` interface (AD-10).
2. Implement `LutTextMeasurer` — uses the 11-family LUT from textspan_lut.c.
   Font name normalization applied before every lookup. Unknown fonts → Times
   metrics + one-time warning. Scale linearly with fontSize.
3. Implement `CanvasTextMeasurer` — wraps Canvas 2D `measureText`.
4. Export `estimate_text_width_1pt(fontName: string, text: string, bold:
   boolean, italic: boolean): number` as a standalone function (for callers
   that need width at 1pt and scale themselves).

## Write-Set

- `src/common/textmeasure.ts`
- `src/common/textmeasure.test.ts`

## Read-Set

- `~/git/graphviz/lib/common/textspan_lut.h` — declaration
- `~/git/graphviz/lib/common/textspan_lut.c` — full implementation (read in
  full; the per-family width tables start at line 37)
- `~/git/graphviz/lib/common/textspan.c` — dispatch logic

## Architecture Decisions

- **AD-10**: TextMeasurer interface abstracts Canvas 2D and LUT. Browser
  environments use `CanvasTextMeasurer`; Node/test environments use
  `LutTextMeasurer`. The interface is defined here; T20 and T23 import it.

## Interface Contracts

```typescript
export interface TextMeasurer {
  measure(text: string, fontname: string, fontsize: number): { w: number; h: number };
}

export class LutTextMeasurer implements TextMeasurer {
  measure(text: string, fontname: string, fontsize: number): { w: number; h: number };
}

export class CanvasTextMeasurer implements TextMeasurer {
  constructor(ctx: CanvasRenderingContext2D);
  measure(text: string, fontname: string, fontsize: number): { w: number; h: number };
}

/**
 * Estimated width of `text` in 1pt using the character-width LUT.
 * Uses the LUT for the given font family (normalized); falls back to Times.
 * Scales the raw LUT width by (1 / units_per_em).
 */
export function estimate_text_width_1pt(
  fontName: string,
  text: string,
  bold: boolean,
  italic: boolean,
): number;
```

## Acceptance Criteria

1. The LUT covers exactly 11 font families. Test: a private or exported list
   `LUT_FAMILY_COUNT === 11`. Assert that all 11 families listed above resolve
   without triggering the fallback warning.
2. `"Times New Roman"` normalizes to `"timesnewroman"` and matches the Times
   family: `LutTextMeasurer.measure('A', 'Times New Roman', 12)` returns the
   same result as `measure('A', 'Times', 12)`.
3. Unknown font logs warning exactly once: call `measure('A', 'UnknownFont',
   12)` three times; the warning is emitted once (verified by spy/mock on
   `console.warn`).
4. `LutTextMeasurer` results scale linearly with fontSize:
   `measure('A', 'Times', 24).w === 2 * measure('A', 'Times', 12).w`
   (within floating-point tolerance 1e-10).

## Observability

`LutTextMeasurer` emits `console.warn` for unrecognized font names (once per
unique name). This is the correct behavior — it matches the C warning
behavior and helps users discover typos in font names.

## Rollback

Reversible. `TextMeasurer` interface is consumed by T20 (htmltable) and T23
(splines). If this module changes, those modules must be retested.

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run src/common/textmeasure.test.ts` exits 0
- All four acceptance criteria pass as explicit test cases
- 90% line coverage, 90% branch coverage (vitest `--coverage`)
