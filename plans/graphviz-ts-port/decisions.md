# Architecture Decisions

All decisions are **locked**. Do not revisit during execution. If an
implementation contradicts a decision below, stop and log to
`decision-journal.md`.

---

## AD-1: agbindrec/GD_*/ND_*/ED_* → typed fields

Replace the C macro-accessor system (`agbindrec`, `AGDATA`, `GD_*`, `ND_*`,
`ED_*`) with plain typed fields on `GraphInfo` / `NodeInfo` / `EdgeInfo`
TypeScript classes. The `mtflock` move-to-front lock is unnecessary (GC).
All engine-specific fields are optional and zeroed on init.

## AD-2: Plugin system → direct dispatch

Replace `lib/gvc`'s `libltdl` dynamic plugin loading with static
registration and direct function calls. Preserve capability negotiation
order: renderers are sorted alpha-ascending by type name, then
descending by quality integer. This order determines which renderer wins
when multiple are registered for the same format name.

## AD-3: Module-global C buffers → owned allocations

`lib/pathplan` and similar libs return pointers into module-global buffers.
The TypeScript port returns owned arrays. The "caller must consume before
next call" contract is eliminated.

## AD-4: VPSC C++ → TypeScript class

`lib/vpsc` is C++. Port as a TypeScript class implementing the identical
VPSC algorithm. Two-pass usage (X axis then Y axis) with independent
`Variable[]` / `Constraint[]` arrays per pass. Teardown order:
`deleteVPSC` → `deleteConstraints` → `deleteVariable`. Convergence
threshold: `|Δcost| ≤ 0.0001`.

## AD-5: cgraph++ and gvc++ RAII wrappers not ported

These wrappers exist only to manage C memory lifetimes. TypeScript has GC;
no equivalent is needed.

## AD-6: lib/sfio, lib/ast, lib/expr, lib/gvpr not ported

Verified to have zero call sites in the layout or SVG rendering path. Only
consumers are `lib/expr` and `lib/gvpr`, which are scripting tools invoked
separately from the layout pipeline. See `typescript-port.md` for
verification details.

## AD-7: ND_alg per-engine via discriminated union

Each layout engine stores a completely different struct in the C `void *
ND_alg`. TypeScript uses a discriminated union on `NodeInfo.alg` with a
`kind` discriminant field. Never use `unknown` or casting.

## AD-8: ND_rank dual-use explicitly typed and documented

`NodeInfo.rank` is repurposed as the x-coordinate during the dot position
phase and restored by `set_xcoords`. The field carries a JSDoc comment
marking the dual-use. Callers must not read `rank` as a rank value while
the position phase is active.

## AD-9: is_exactly_zero uses DataView bit comparison

`is_exactly_zero(v: number)` is implemented with `Float64Array` /
`DataView` bitwise comparison of the 8 bytes, not `v === 0`. This matches
C `memcmp` semantics: returns `false` for `-0.0`.

## AD-10: TextMeasurer interface abstracts Canvas and LUT

Text measurement is injected via a `TextMeasurer` interface:
```typescript
interface TextMeasurer {
  measure(text: string, fontname: string, fontsize: number): { w: number; h: number };
}
```
Browser environments provide a Canvas 2D implementation. Node/test
environments use the LUT from `lib/common/textspan_lut.h` as primary (not
fallback). This keeps all layout algorithms free of DOM APIs.

## AD-11: DOT parser via Peggy

Parse the DOT language using a Peggy-generated parser from a `.pegjs`
grammar file at `src/parser/dot.pegjs`. The PEG grammar is derived from
`lib/cgraph/grammar.y` and `lib/cgraph/scan.l` and is the canonical
artifact for faithfulness verification. Build command:
`peggy --format es --dts src/parser/dot.pegjs`. The generated file is
committed. No parser-generator runtime dependency.

## AD-12: Renderer scope

In scope: SVG (`gvrender_core_svg.c`), DOT/XDOT (`gvrender_core_dot.c`),
JSON (`gvrender_core_json.c`), plain/IMAP/CMAPX (`gvrender_core_map.c`).
Out of scope for initial port: FIG renderer (`gvrender_core_fig.c`).

## AD-13: Tests are the immutable spec commitment — code must satisfy tests, never the reverse

**This is the primary quality constraint for all porting work and is not
negotiable under any circumstance.**

### The rule

Every test assertion expresses a behavioral requirement derived from the
C source (code, output, or both). Once a test assertion is written it is
**frozen**. If a test fails, the implementation is wrong. Fix the code.

**Changing a test assertion to make a test pass is always wrong.**

### Required workflow — every task, every test

1. **Read the C source first.** Identify the exact behavior: the algorithm,
   the output values, the edge cases, the error messages.
2. **Derive expected values from C.** If a function returns a number, run
   the C binary or trace through the algorithm by hand to obtain the
   ground-truth value before writing any TypeScript.
3. **Write the test.** Commit the expected values as assertions.
4. **Write the implementation.** Make it satisfy the tests.
5. **If a test fails, fix the code.** Read the C again. The test is correct.

### Stop condition (triggers autonomous-mode halt)

If a failing test can only be made to pass by changing the test assertion
rather than the implementation, **STOP**. Log the discrepancy in
`decision-journal.md` and wait for human input. Do not alter the test.
