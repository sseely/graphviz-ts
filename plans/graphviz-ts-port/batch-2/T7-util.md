# T7 — lib/util Port

## Context

`lib/util` is the bottom of the Graphviz dependency graph. Every other `lib/`
folder imports from it. It provides:

- `agxbuf` — a dynamic string buffer with Short String Optimization (SSO).
  On x86-64 the inline store holds 31 bytes before spilling to the heap.
  The C implementation stores the inline/heap discriminant in a single
  `unsigned char located` field (0..254 = inline with that many bytes used;
  255 = heap). TypeScript has no equivalent packed union — use a class with
  an explicit internal mode flag.
- `LIST` macro — a type-generic doubly-linked intrusive list. TypeScript
  replaces this with a generic typed class.
- `gv_xml_escape` — XML/SVG escaping with a flags struct controlling raw
  mode, dash escaping, non-breaking space coercion, and UTF-8 encoding.
  The `raw` flag determines whether `&` is always escaped or only when it
  does not appear to start a pre-encoded entity like `&amp;`.
- `is_exactly_zero` — bit-exact zero check using `memcmp`, not `==`.
  `-0.0 === 0.0` in TypeScript (same as C's `==`) but `memcmp` distinguishes
  them. This is AD-9 and is used in SVG float output normalization.
- `gv_strtod` — locale-safe `strtod`; the TypeScript port uses
  `parseFloat()` which is always locale-independent, so this is a thin
  wrapper confirming that contract.
- MT19937 Mersenne Twister PRNG — used by `lib/neatogen/sgd.c` for
  Fisher-Yates shuffling of SGD terms. The C source is
  `lib/neatogen/randomkit.c` (Random Kit 1.3, Jean-Sebastien Roy, based on
  Matsumoto/Nishimura MT). The port must produce bit-identical output to the
  C reference for any given seed. `Math.random()` is forbidden.

`agxbuf_trim_zeros` is also part of this port — it trims trailing fractional
zeros from float strings in-buffer (`"42.00"` → `"42"`, `"-0.0"` → `"0"`).
This function is called in SVG rendering paths.

## Task

Port the following from `lib/util/` and `lib/neatogen/randomkit.c`:

1. **`AgBuffer`** (`src/util/agxbuf.ts`): TypeScript class mirroring `agxbuf`
   behavior. Methods: `append(s: string)`, `appendChar(c: string)`,
   `clear()`, `str(): string` (equivalent to `agxbuse` — resets and returns
   content), `disown(): string` (equivalent to `agxbdisown` — caller takes
   ownership), `length(): number`, `pop(): string | null`,
   `trimZeros(): void` (mirrors `agxbuf_trim_zeros`). The SSO threshold need
   not be replicated in TypeScript — the observable contract is what matters,
   not the memory layout. `str()` must match `agxbuse` semantics: it resets
   the buffer and the returned string is valid only until the next write.

2. **`List<T>`** (`src/util/list.ts`): Generic typed doubly-linked list
   replacing the `LIST` macro. API: `push(item: T)`, `pop(): T | undefined`,
   `shift(): T | undefined`, `unshift(item: T)`, `remove(item: T): boolean`,
   `[Symbol.iterator]()`. The C LIST macro is intrusive (embeds link pointers
   in the data object); the TypeScript version wraps items in nodes
   internally.

3. **`gvXmlEscape`** (`src/util/xml.ts`): Port of `gv_xml_escape`. Signature:
   ```typescript
   interface XmlFlags {
     raw: boolean;   // escape & unconditionally; also escape \n and \r
     dash: boolean;  // escape '-' as &#45;
     nbsp: boolean;  // convert 2nd+ consecutive space to &#160;
     utf8: boolean;  // encode non-ASCII as &#xNNNN;
   }
   function gvXmlEscape(s: string, flags: XmlFlags): string;
   ```
   The `utf8` flag must emit `&#xNNNN;` numeric hex entities (not `&name;`
   forms like `&nbsp;`) for non-ASCII codepoints. The `nbsp` flag uses
   `&#160;` specifically (not `&nbsp;`) — Inkscape does not recognize
   `&nbsp;`. Characters always escaped: `<` → `&lt;`, `>` → `&gt;`,
   `"` → `&quot;`, `'` → `&#39;`. When `raw=false`, the `&` in
   pre-encoded entities (`&amp;`, `&#38;`, `&#x26;`) is NOT re-escaped;
   verify using the `xml_isentity` logic from `xml.c`.

4. **`isExactlyZero`** and **`isExactlyEqual`** (`src/util/math.ts`):
   ```typescript
   function isExactlyZero(v: number): boolean;
   function isExactlyEqual(a: number, b: number): boolean;
   ```
   Must use `Float64Array`/`DataView` bit-level comparison (AD-9).
   `isExactlyZero(-0.0)` must return `false`. `isExactlyZero(0.0)` must
   return `true`. Also port `fcmp` (three-way double comparator returning
   -1/0/1), `imax`, `imin`, `d2i` (clamp double to int), `d2f` (clamp
   double to float), and `gvStrtod` (thin wrapper around `parseFloat` that
   returns `NaN` for non-numeric strings, matching C `strtod` semantics
   for invalid input).

5. **`MT19937`** (`src/util/mt19937.ts`): Port of `lib/neatogen/randomkit.c`
   (Random Kit 1.3). The public API from the C bridge is:
   - `rk_seed(seed: number, state: RkState): void`
   - `rk_random(state: RkState): number` — returns a 32-bit unsigned integer
   - `rk_interval(max: number, state: RkState): number` — returns integer
     in [0, max] inclusive
   Port verbatim: the 624-element state array, the initialization multiplier
   `1812433253`, the twist constants (`0x9908b0df`, etc.), and the tempering
   operations. Use `Uint32Array` for the state. All arithmetic must be
   performed in 32-bit unsigned integer space (use `>>> 0` to truncate).
   Do NOT use `Math.random()` anywhere in this file.

6. **`src/util/index.ts`**: Re-export all public symbols from the five files
   above.

## Write-Set

- `src/util/agxbuf.ts`
- `src/util/list.ts`
- `src/util/xml.ts`
- `src/util/math.ts`
- `src/util/mt19937.ts`
- `src/util/index.ts`
- `src/util/util.test.ts`

## Read-Set

- `~/git/graphviz/lib/util/agxbuf.h` — full SSO implementation and API
- `~/git/graphviz/lib/util/agxbuf.c` — if it exists (some functions may be
  in .c rather than inline in .h)
- `~/git/graphviz/lib/util/list.h` — LIST macro definition
- `~/git/graphviz/lib/util/gv_math.h` — is_exactly_zero, is_exactly_equal,
  fcmp, d2i, d2f definitions
- `~/git/graphviz/lib/util/xml.h` — xml_flags_t declaration
- `~/git/graphviz/lib/util/xml.c` — gv_xml_escape and xml_isentity
- `~/git/graphviz/lib/neatogen/randomkit.c` — MT19937 implementation
  (the actual PRNG source — the mission brief incorrectly cites sgd.c;
  the PRNG lives in randomkit.c)
- `~/git/graphviz/lib/neatogen/randomkit.h` — rk_state struct and API
- `~/git/graphviz/docs/architecture/lib/util.md` — behavioral subtleties

## Architecture Decisions

- **AD-9**: `is_exactly_zero` uses `Float64Array`/`DataView` bit comparison,
  not `===`. Returns `false` for `-0.0`.

## Interface Contracts

```typescript
// src/util/agxbuf.ts
export class AgBuffer {
  append(s: string): this;
  appendChar(c: string): this;
  appendN(s: string, n: number): this;
  clear(): void;
  str(): string;       // resets buffer; returned string valid until next write
  disown(): string;    // caller owns returned string; buffer is reset
  length(): number;
  pop(): string | null;
  trimZeros(): void;   // agxbuf_trim_zeros semantics
}

// src/util/math.ts
export function isExactlyZero(v: number): boolean;
export function isExactlyEqual(a: number, b: number): boolean;
export function fcmp(a: number, b: number): -1 | 0 | 1;
export function imax(a: number, b: number): number;
export function imin(a: number, b: number): number;
export function d2i(v: number): number;
export function d2f(v: number): number;
export function gvStrtod(s: string): number;

// src/util/mt19937.ts
export interface RkState { mt: Uint32Array; mti: number; }
export function rkSeed(seed: number, state: RkState): void;
export function rkRandom(state: RkState): number;
export function rkInterval(max: number, state: RkState): number;
export function rkNewState(): RkState;

// src/util/xml.ts
export interface XmlFlags {
  raw: boolean; dash: boolean; nbsp: boolean; utf8: boolean;
}
export function gvXmlEscape(s: string, flags: XmlFlags): string;
```

## Acceptance Criteria

**Given** `isExactlyZero` is called with `0.0`,  
**When** the function evaluates the bit pattern,  
**Then** it returns `true`.

**Given** `isExactlyZero` is called with `-0.0`,  
**When** the function evaluates the bit pattern via `DataView`,  
**Then** it returns `false` (bit patterns differ: `+0.0` = all zeros,
`-0.0` = sign bit set).

**Given** an `AgBuffer` with content `"42.00"`,  
**When** `trimZeros()` is called,  
**Then** `str()` returns `"42"` (matches `agxbuf_trim_zeros` C behavior).

**Given** `rkSeed(0, state)` followed by ten calls to `rkRandom(state)`,  
**When** the output sequence is compared to the C reference from
`randomkit.c` with `seed=0`,  
**Then** all ten values are identical (bit-exact match).

## Observability

N/A — pure library functions; no async paths, no I/O.

## Rollback

Reversible. This task writes only new files under `src/util/`. No existing
files are modified. Revert by removing the directory.

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run src/util/util.test.ts` exits 0
- One commit: `feat(util): port lib/util agxbuf, list, xml, math, mt19937`
- Test file covers: `isExactlyZero` with `+0.0` and `-0.0`, `AgBuffer.str()`
  reset semantics, `AgBuffer.trimZeros()` all four examples from the C
  comment (`"42.00"`, `"42.01"`, `"42.10"`, `"-0.0"`), and MT19937 seed-0
  reference sequence (minimum 10 values).
