# T19 — Color System

## Context

The project is a faithful TypeScript 5.x port of Graphviz `lib/`, targeting
SVG output. TypeScript strict mode, Vitest, esbuild, EPL-2.0, no Node.js in
core.

`lib/common/color.h` defines `gvcolor_t` — the union type that holds colors
in multiple representations. `lib/common/colxlate.c` implements:
- `colorxlate` — the main color parsing entry point; dispatches to
  HSV/RGB/RGBA/X11/SVG color name resolution
- HSV↔RGB conversion with the exact formulae from the C source
- X11 color name lookup
- SVG color name lookup
- Brewer color scheme support (slash-separated names like `"/paired9/3"`)
- Gradient specification parsing (handled in `lib/xdot` but color values
  are parsed via `colorxlate`)

`lib/common/colorprocs.h` declares `colorxlate` and `setColorScheme`.

## Task

Port the color system to `src/common/color.ts`:

### `GVColor` union type

```typescript
export type GVColor =
  | { type: 'rgba';    r: number; g: number; b: number; a: number }  // [0,1]
  | { type: 'hsva';    h: number; s: number; v: number; a: number }  // [0,1]
  | { type: 'string';  s: string }
  | { type: 'none' };
```

### `colorxlate`

```typescript
export function colorxlate(
  str: string,
  color: GVColor,
  targetType: ColorType,
): ColorxlateResult;
```

Port the complete `colorxlate` logic from `colxlate.c`. Handles:
1. Empty/whitespace string → type 'none'
2. Leading `#` → hex RGB/RGBA: `#rrggbb` or `#rrggbbaa`
3. Leading digit → HSV string `H,S,V` (floats 0–1)
4. Brewer scheme: starts with `/` → `colorscheme/index`
5. Otherwise: X11 or SVG name lookup (case-insensitive)

Return type:

```typescript
export const enum ColorxlateResult {
  ColorOk = 0,
  ColorUnknown = 1,
  ColorError = 2,
}
```

### HSV↔RGB

Port `hsv2rgb` and `rgb2hsv` exactly from `colxlate.c`. The HSV→RGB
conversion uses the standard sector-based formula with fractional-sector
interpolation. Port these as pure functions.

```typescript
export function hsv2rgb(h: number, s: number, v: number): { r: number; g: number; b: number };
export function rgb2hsv(r: number, g: number, b: number): { h: number; s: number; v: number };
```

### X11 color name table

Port the full X11 color name table from `colxlate.c` as a static lookup map.
The table is large (~750 entries); it must be present in full. Look up names
case-insensitively.

### SVG color name table

Port the SVG named color table. Lookup is case-insensitive.

### Brewer color schemes

Port `setColorScheme` and the Brewer color scheme lookup. The default color
scheme is `x11`.

```typescript
export function setColorScheme(scheme: string): void;
export function getColorScheme(): string;
```

### Gradient color parsing

`GVColor` with `type: 'string'` is used to hold gradient specifications
(passed through to xdot parsing). `colorxlate` does not parse gradients
directly; gradient parsing is in `lib/xdot/xdot.c` (T15). `color.ts` must
not import from `src/xdot/`.

### Error handling

An invalid color string (not parseable, unknown name) returns
`ColorxlateResult.ColorUnknown`. It does not throw. The `color` output
parameter is not modified on error.

## Write-Set

- `src/common/color.ts`
- `src/common/color.test.ts`

## Read-Set

- `~/git/graphviz/lib/common/color.h` — `gvcolor_t` type
- `~/git/graphviz/lib/common/colxlate.c` — full implementation (X11 table,
  SVG table, Brewer schemes, HSV conversion, colorxlate logic)
- `~/git/graphviz/lib/common/colorprocs.h` — public API declarations

## Architecture Decisions

No task-specific architecture decisions. The color system is a pure
translation of C to TypeScript with no structural changes.

## Interface Contracts

```typescript
export type ColorType = 'rgba' | 'hsva' | 'string';

export const enum ColorxlateResult {
  ColorOk = 0,
  ColorUnknown = 1,
  ColorError = 2,
}

export function colorxlate(
  str: string,
  color: GVColor,
  targetType: ColorType,
): ColorxlateResult;

export function hsv2rgb(
  h: number, s: number, v: number
): { r: number; g: number; b: number };

export function rgb2hsv(
  r: number, g: number, b: number
): { h: number; s: number; v: number };

export function setColorScheme(scheme: string): void;
export function getColorScheme(): string;
```

## Acceptance Criteria

1. `hsv2rgb(0, 1, 1)` returns `{ r: 1, g: 0, b: 0 }` (pure red). The exact
   red value from the Graphviz HSV formula, not an approximation.
2. X11 `"red"` resolves correctly: `colorxlate('red', color, 'rgba')` returns
   `ColorxlateResult.ColorOk` and populates color with `r=1, g=0, b=0, a=1`.
3. Invalid color string returns error: `colorxlate('notacolor', color, 'rgba')`
   returns `ColorxlateResult.ColorUnknown` and does not modify `color`.
4. `setColorScheme` / `getColorScheme` roundtrip: set a valid Brewer scheme,
   verify `getColorScheme()` returns it.

## Observability

N/A — pure algorithm module. `setColorScheme` writes module-level state; it
is the only stateful function, and it matches the C `setColorScheme` global.

## Rollback

Reversible. Removal only affects downstream importers.

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run src/common/color.test.ts` exits 0
- All four acceptance criteria pass as explicit test cases
- 90% line coverage, 90% branch coverage (vitest `--coverage`)
