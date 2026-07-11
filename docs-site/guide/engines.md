# Layout engines

All eight Graphviz layout engines are registered. Pass the engine name as the
second argument to `renderSvg`:

```ts
renderSvg(dot, 'neato');
```

| Engine       | Layout style                                  |
|--------------|-----------------------------------------------|
| `dot`        | Hierarchical / layered directed graphs        |
| `neato`      | Spring-model (Kamada–Kawai)                   |
| `fdp`        | Force-directed                                |
| `sfdp`       | Multiscale force-directed (large graphs)      |
| `circo`      | Circular                                      |
| `twopi`      | Radial                                        |
| `osage`      | Clustered                                     |
| `patchwork`  | Squarified treemap                            |

## Fidelity note

Engines split into two conformance classes (see [Conformance](/conformance)
for the exact definition and comparison code):

- **Deterministic** — `dot`, `circo`, `twopi`, `osage`, `patchwork`. Held to
  the same **±0.01** bar: numeric coordinates and paths agree with the native
  C binary within ±0.01pt and all non-numeric content (tags, colors, text) is
  exactly equal on the golden corpus.
- **Iterative** — `neato`, `fdp`, `sfdp`. Force-directed/multiscale solvers
  that depend on floating-point rounding order, so they are checked at a
  looser **±0.5**pt bound and for structural (same element tree) agreement
  rather than tight numeric equality.

Neither bar is a claim of literal byte-for-byte SVG output. For current pass
counts and any accepted divergences per engine, see [Parity](/parity) (with
per-engine detail pages) and [Known divergences](/divergences).

## Try different engines

Switch the engine in the dropdown to compare layouts of the same graph:

<Playground
  height="380px"
  :initial="`graph {\n  a -- b; a -- c; a -- d;\n  b -- c; c -- d; d -- b;\n  b -- e; c -- f;\n}`"
  engine="neato"
/>
