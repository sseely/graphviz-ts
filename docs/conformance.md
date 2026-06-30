<!-- SPDX-License-Identifier: EPL-2.0 -->

# Conformance: what "match" means

graphviz-ts is validated against the canonical C Graphviz binary as an oracle.
When this project says a graph **matches** C — the parity verdict named
`conformant` — it means a specific, mechanically-checked property, **not**
literal byte-for-byte equality of the SVG text.

> **Definition.** A port render is **conformant** with the oracle render when,
> after both SVGs are parsed into a normalized element tree:
>
> 1. every **numeric** value (coordinates, path data, `points`, `viewBox`,
>    `transform` parameters) agrees with the oracle within a fixed
>    **tolerance**, and
> 2. every **non-numeric** value (tag names, colors, text content, attribute
>    keys, enumerated attribute values) is **exactly equal**.
>
> If any numeric value exceeds the tolerance, or any non-numeric value differs,
> the render is **not** conformant.

## Why not literal bytes?

SVG serializes floating-point coordinates as decimal text. Two renders that are
mathematically equivalent can still differ in the last printed digit because of
IEEE-754 rounding, the order of floating-point operations, and platform
`libm`/FMA behavior that varies by CPU and JS engine. A literal byte bar would
therefore be **untestable** across the runtimes this library targets (browsers,
Node, different CPUs) rather than merely strict. Conformance pins the property
that actually matters — the geometry and content a viewer sees — to a bound
small enough to be sub-perceptual.

## The exact tolerance

The tolerance is **per engine class**, defined in
[`test/golden/compare.ts`](https://github.com/sseely/graphviz-ts/blob/main/test/golden/compare.ts):

| Class | Tolerance (pt) | Engines |
|---|---:|---|
| `deterministic` | **±0.01** | `dot`, `circo`, `twopi`, `osage`, `patchwork` |
| `iterative` | **±0.5** | `neato`, `fdp`, `sfdp` |

The deterministic engines reproduce C's integer/printed coordinates essentially
exactly, so ±0.01 only absorbs decimal-formatting noise. The iterative
(force-directed) engines depend on transcendental functions whose last-bit
results are not reproducible across platforms, so they carry a looser bound and
are additionally checked for **structural** equality (same element tree).

The **corpus parity survey** evaluates every graph in the `deterministic` mode
(±0.01) regardless of engine — see
[`test/corpus/survey.ts`](https://github.com/sseely/graphviz-ts/blob/main/test/corpus/survey.ts)
(`diffVerdict` → `compareSvg(port, oracle, 'deterministic')`).

## Read the code

The definition above is not prose aspiration — it is exactly what the
comparison code does. To verify it yourself:

- [`test/golden/compare.ts`](https://github.com/sseely/graphviz-ts/blob/main/test/golden/compare.ts)
  — `TOLERANCES` (the ±0.01 / ±0.5 table), and `compareSvg`, which walks the two
  normalized trees and applies rule (1) numeric-within-tolerance and rule (2)
  non-numeric-exact attribute by attribute.
- [`test/golden/normalize.ts`](https://github.com/sseely/graphviz-ts/blob/main/test/golden/normalize.ts)
  — how raw SVG is parsed into the comparable element tree.
- [`test/corpus/survey.ts`](https://github.com/sseely/graphviz-ts/blob/main/test/corpus/survey.ts)
  — `diffVerdict`, which assigns one of the verdicts below.

## The verdicts

The survey assigns each graph exactly one verdict
([`PARITY.md`](https://github.com/sseely/graphviz-ts/blob/main/test/corpus/PARITY.md)
tracks the live counts):

| Verdict | Meaning |
|---|---|
| **`conformant`** | Matches the oracle per the definition above (numeric within tolerance, non-numeric exact). |
| **`structural-match`** | Same element tree, but one or more numeric values exceed the tolerance. |
| **`diverged`** | The element trees differ (a missing/extra element or a non-numeric mismatch). |
| **`oracle-error`** | The C oracle failed to render the input (excluded from port scoring). |
| **`errored` / `timeout`** | The port failed to render or exceeded the time budget. |

"Conformant" is the bar; "structural-match" is meaningful progress (right shape,
coordinates still drifting); "diverged" is a real gap. None of these is a claim
of byte-for-byte output.
