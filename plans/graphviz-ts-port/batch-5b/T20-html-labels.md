# T20 — HTML Label Parser

## Context

The project is a faithful TypeScript 5.x port of Graphviz `lib/`, targeting
SVG output. TypeScript strict mode, Vitest, esbuild, EPL-2.0, no Node.js in
core.

`lib/common/htmltable.c` (1941 lines) implements the HTML-like label parser
and layout engine. HTML-like labels in DOT use `<...>` syntax (not plain
strings) and support nested tables, font tags, cell formatting, images,
colspan/rowspan, and horizontal/vertical rules.

The architecture doc (`lib/common.md`) describes this file as "HTML label
layout and rendering; cell sizing, colspan/rowspan, grid rules."

This task ports the parser and the AST (the `htmllabel_t`, table/cell/text
struct hierarchy), plus the layout sizing step. The actual rendering pass
(which calls renderer callbacks) is part of `emit.c` (T24).

`lib/common/htmllex.c` and `lib/common/htmlparse.y` implement the lexer and
Bison grammar. In TypeScript, implement a hand-written recursive descent
parser or use a simple character-by-character tokenizer — do not introduce a
grammar-tool dependency for this.

## Task

### AST types

Port the `htmllabel_t` hierarchy from `lib/common/htmltable.h`:

- `HtmlLabel` — top-level; either a table or a text list
- `HtmlTable` — `<TABLE>` with attributes (border, cellborder, cellspacing,
  cellpadding, bgcolor, style, align, valign, fixedsize, width, height, rows)
- `HtmlCell` — `<TD>` with attributes (port, align, valign, balign,
  bgcolor, color, border, cellpadding, cellspacing, sides, style, width,
  height, fixedsize, colspan, rowspan, href, title, target, id)
- `HtmlText` — inline text content, possibly with style spans
- `HtmlImage` — `<IMG>` with src and scale attributes
- `HtmlFont` — `<FONT>` with color, face, point-size attributes
- `HtmlRow` — `<TR>` containing cells
- `HtmlHR` / `HtmlVR` — horizontal and vertical rules

### Parser

```typescript
export function parseHtmlLabel(src: string): HtmlLabel;
```

Parse an HTML-like label string (the content between `<...>` delimiters; the
outer `<` and `>` have already been stripped by the DOT parser before this
function is called).

Supported tags (all case-insensitive in the input):
`TABLE`, `TR`, `TD`, `FONT`, `BR`, `IMG`, `B`, `I`, `U`, `O`, `S`, `SUB`,
`SUP`, `HR`, `VR`, `/TABLE`, `/TR`, `/TD`, `/FONT`, `/B`, `/I`, `/U`, `/O`,
`/S`, `/SUB`, `/SUP`.

**`<B>`, `<I>`, `<U>`, `<O>`, `<S>`, `<SUB>`, `<SUP>`** produce bold,
italic, underline, overline, strikethrough, subscript, superscript text span
modifiers on the containing text content.

**`<BR>`** produces a line break. Attributes: `ALIGN="left|center|right"`.

**Unrecognized tags**: throw a `HtmlParseError` with a message naming the
unrecognized tag. Do not silently ignore unknown tags — match C's error
behavior.

**Attribute parsing**: attribute values may be unquoted or double-quoted.
Parse all attribute names case-insensitively. Values are always strings at
parse time; the layout step converts widths/heights to numbers.

### Layout sizing

```typescript
export function sizeHtmlLabel(label: HtmlLabel, measurer: TextMeasurer): void;
```

Computes the `dimen` (width × height) for each cell, row, and the overall
table, respecting `colspan`, `rowspan`, `fixedsize`, `cellspacing`,
`cellpadding`, and `border` attributes. Writes computed dimensions back into
the AST nodes.

The `TextMeasurer` interface is defined in T21 (`src/common/textmeasure.ts`).
Import it but do not implement it here.

The layout algorithm matches `htmltable.c`'s sizing logic:
1. Size leaf text cells (via `TextMeasurer.measure`)
2. Propagate colspan/rowspan — cells spanning multiple columns/rows
   contribute to the maximum column widths and row heights
3. Apply fixed-size overrides (`fixedsize="true"`)
4. Apply table-level `width` and `height` overrides

## Write-Set

- `src/common/htmltable.ts`
- `src/common/htmltable.test.ts`

## Read-Set

- `~/git/graphviz/lib/common/htmltable.c` — full implementation (1941 lines;
  read in full — the layout sizing is interleaved with the struct definitions)
- `~/git/graphviz/lib/common/htmltable.h` — struct definitions and flag
  constants (alignment flags, border flags, etc.)
- `~/git/graphviz/lib/common/htmllex.c` — lexer tokens (to understand what
  tokens the grammar expects)
- `~/git/graphviz/lib/common/htmlparse.y` — grammar rules (to understand
  what structures each production builds)

## Architecture Decisions

No task-specific architecture decisions. This is a straightforward port of
the parser and layout sizing logic.

## Interface Contracts

```typescript
/** Thrown when an unrecognized or malformed tag is encountered. */
export class HtmlParseError extends Error {
  readonly tag: string;  // the unrecognized tag name
}

export type HtmlAlign = 'left' | 'center' | 'right';
export type HtmlVAlign = 'top' | 'middle' | 'bottom';

export interface HtmlLabel {
  kind: 'table' | 'text';
  table?: HtmlTable;
  texts?: HtmlText[];
  // computed by sizeHtmlLabel:
  dimen?: { w: number; h: number };
}

export interface HtmlTable { /* ... all attributes from htmltable.h ... */ }
export interface HtmlRow   { cells: HtmlCell[] }
export interface HtmlCell  { /* ... all attributes + computed dimen */ }

export interface TextMeasurer {
  measure(text: string, fontname: string, fontsize: number): { w: number; h: number };
}

export function parseHtmlLabel(src: string): HtmlLabel;
export function sizeHtmlLabel(label: HtmlLabel, measurer: TextMeasurer): void;
```

## Acceptance Criteria

1. `<B>text</B>` produces a text span with a bold modifier applied to
   "text": `parseHtmlLabel('<B>text</B>')` results in an `HtmlLabel` with
   kind `'text'` and a text span with `bold: true`.
2. Nested `<TABLE>` produces correct cell layout: a 1×2 table (`<TR>` with
   two `<TD>`) has `table.rows[0].cells.length === 2`.
3. Unrecognized tag throws: `parseHtmlLabel('<SPAN>text</SPAN>')` throws
   `HtmlParseError` with `tag === 'SPAN'`.
4. `sizeHtmlLabel` propagates colspan: a cell with `colspan="2"` in a 2-column
   table has `dimen.w >= columnWidth1 + columnWidth2 + cellspacing`.

## Observability

N/A — pure parser + layout algorithm.

## Rollback

Reversible. Nothing imports from `src/common/htmltable.ts` until T24 (emit).

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run src/common/htmltable.test.ts` exits 0
- All four acceptance criteria pass as explicit test cases
- 90% line coverage, 90% branch coverage (vitest `--coverage`)
