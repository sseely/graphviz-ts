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

The `dot` engine receives the most fidelity attention because the primary
consumer is DOT-centric, and it is **conformant** with the native C binary on
the golden corpus at defaults — numeric coordinates and paths agree within ±0.01
and all non-numeric content (tags, colors, text) is exactly equal. This is the
project's "match" bar; it is **not** a claim of literal byte-for-byte SVG
output. See [Conformance](/conformance) for the exact definition and the
comparison code.

The force-directed engines (`neato`, `fdp`, `sfdp`, `circo`, `twopi`, `osage`)
are structurally faithful but **not** guaranteed to reproduce identical
coordinates across platforms, because they depend on floating-point rounding
that varies by JS engine and CPU. See [Known divergences](/divergences) for details.

## Try different engines

Switch the engine in the dropdown to compare layouts of the same graph:

<Playground
  height="380px"
  :initial="`graph {\n  a -- b; a -- c; a -- d;\n  b -- c; c -- d; d -- b;\n  b -- e; c -- f;\n}`"
  engine="neato"
/>
