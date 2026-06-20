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
consumer is DOT-centric, and it matches the native C binary byte-for-byte on the
golden corpus at defaults.

The force-directed engines (`neato`, `fdp`, `sfdp`, `circo`, `twopi`, `osage`)
are structurally faithful but **not** guaranteed byte-identical across
platforms, because they depend on floating-point rounding that varies by JS
engine and CPU. See [Known divergences](/divergences) for details.

## Try different engines

Switch the engine in the dropdown to compare layouts of the same graph:

<Playground
  height="380px"
  :initial="`graph {\n  a -- b; a -- c; a -- d;\n  b -- c; c -- d; d -- b;\n  b -- e; c -- f;\n}`"
  engine="neato"
/>
