<!-- SPDX-License-Identifier: EPL-2.0 -->

# Known divergences from C Graphviz

graphviz-ts aims for **bit-for-bit fidelity** to the canonical C implementation.
Where the output differs in a known, bounded way, it is recorded here so
consumers can rely on the library without surprises.

This is a living document. The authoritative, continuously-updated records are:

- [`test/corpus/PARITY.md`](https://github.com/sseely/graphviz-ts/blob/main/test/corpus/PARITY.md) — the per-input parity
  dashboard (port vs. native `dot` oracle) with current verdict counts.
- [`plans/port-catalog/README.md`](https://github.com/sseely/graphviz-ts/blob/main/plans/port-catalog/README.md) — the
  algorithm-level port-status inventory.

## 1. Floating-point determinism (force-directed engines)

**Affected:** `neato`, `fdp`, `sfdp`, `circo`, `twopi`, `osage`.

These engines run iterative numerical layouts whose results depend on
floating-point rounding — specifically fused multiply-add (FMA) and `Math.pow`
behavior, which can differ across JavaScript engines and CPU architectures. The
port matches C's floating-point operation order where it can (see
`src/common/fma.ts` and `src/common/arm-pow.ts`), but **exact, byte-identical
reproduction of these iterative layouts is not guaranteed cross-platform.**

This is a hard constraint of running in JS, not a design choice. In practice the
layouts are *structurally* equivalent — same topology, node positions within a
small epsilon — which is why these engines are compared with a structural /
tolerance bar rather than a byte bar.

The `dot` engine is **not** affected: its layout is byte-targetable and matched
exactly on the golden corpus.

## 2. `dot` engine — attribute & edge-case long tail

At **defaults**, the `dot` engine matches the C binary byte-for-byte on the
golden corpus. Divergences appear in the **long tail of attributes and edge
cases** — the historically hard part of any Graphviz port. The differences
cluster into a few categories (tracked live, with counts, in
[`PARITY.md`](https://github.com/sseely/graphviz-ts/blob/main/test/corpus/PARITY.md)):

| Category | What differs |
|---|---|
| **path-structure** | Edge spline routing in specific configurations (e.g. some flat-edge and dense-corridor cases). |
| **element-count** | A feature that emits extra/fewer SVG elements than C in certain graphs. |
| **color-stroke** | Stroke/fill emission differences for specific style attributes. |
| **font-metrics** | Text-extent estimation differences affecting label-driven sizing. |
| **parser-gap** | A small number of DOT inputs the parser does not yet fully accept. |

If your graph uses only common attributes and the `dot` engine, you are almost
certainly on the byte-exact path. If you hit a layout that looks wrong, check
`PARITY.md` for that input class — it is likely a tracked item with an
oracle-pinned fix mission, not an unknown.

## 3. Intentionally not ported (non-goals)

These are deliberate scope boundaries, not bugs. The library targets **SVG**
(plus the `json` / `xdot` / `dot` / imagemap intermediate text formats).

- **Other output formats.** Raster (PNG/JPG/GIF/WebP/BMP), PostScript/PDF/EPS,
  and GUI/interactive backends are out of scope. Use the SVG output and convert
  downstream if you need a raster.
- **`-Tplain` text output.** Deferred (faithful text format), not excluded.
- **`gvpr`** (the graph-processing scripting language) — out of scope.
- **C++ convenience wrappers** (`cgraph++`, `gvc++`) — the C API is ported
  first; an idiomatic-TypeScript convenience layer, if wanted, would be a
  separate package.
- **Native-only mechanics** replaced by browser-safe equivalents: dynamic
  plugin loading (`dlopen`) is replaced by static engine/renderer registration;
  filesystem reads (fonts, images, config) are replaced by caller-supplied
  callbacks (e.g. `setImageSizer`). Behavior is preserved; the mechanism differs.

## Reporting a divergence

If you find output that differs from C and is **not** covered above or in
`PARITY.md`, that is a bug worth reporting — the C source is the spec, and
unlisted divergences are treated as defects, not accepted behavior.
