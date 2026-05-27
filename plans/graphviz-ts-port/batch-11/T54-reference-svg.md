# T54 — Generate Reference SVGs from C Binary

## Context

Stack: TypeScript 5.x strict, Vitest, esbuild, EPL-2.0.

This task generates the 50 reference SVG files and 50 input `.dot`
files that T55's end-to-end suite compares against. The reference SVGs
are produced by the C Graphviz binary (`dot -Tsvg`), which is the
ground truth for this port.

This task runs in parallel with T53. Neither depends on the other.
Requires: C Graphviz binary available on PATH (`dot --version` succeeds).

## Task

Produce 50 representative input `.dot` files and run the C binary on
each to generate corresponding reference SVG files. Write a
`manifest.json` listing all 50 pairs.

### Input file coverage requirements

All 8 engines must be represented. Minimum 5 graphs per engine (50
total allows 6 or 7 per engine — distribute as: dot: 8, neato: 7,
fdp: 6, sfdp: 5, circo: 6, twopi: 6, osage: 6, patchwork: 6).

Within each engine, cover:

**Node shapes (at least one input per listed shape):**
- `box`, `ellipse`, `circle`, `diamond`, `polygon`
- `record` with multiple fields
- HTML label (`<TABLE>` with cells)

**Edge types (at least one input per listed type):**
- `dir=forward`, `dir=back`, `dir=both`, `dir=none`
- `style=dashed`, `style=dotted`, `style=bold`

**Graph structure:**
- Simple connected graph (< 10 nodes)
- Disconnected graph (2+ components)
- Subgraphs and clusters (`subgraph cluster_X`)
- Nested clusters (cluster containing a cluster)

**Large graphs (sfdp only):**
- At least 1 graph with 100+ nodes for sfdp performance validation

**Engine-specific:**
- circo: graph with multiple biconnected components
- twopi: star graph; chain graph
- osage: graph with 3 levels of cluster nesting
- patchwork: graph where nodes have `area` attributes set

### How to produce inputs

Write the `.dot` files by hand as minimal, readable examples. Do not
copy them from the Graphviz test suite verbatim — write them fresh so
they are clearly under EPL-2.0 and serve as documentation.

Each file should be self-contained, under 30 lines, and include a
comment at the top:

```dot
// graphviz-ts reference input: <brief description>
// engine: <engine name>
// tolerance: <deterministic|iterative>
```

### How to produce reference SVGs

For each input file:
```bash
dot -K<engine> -Tsvg <input>.dot > <output>.svg
```

Where `dot` is the system Graphviz binary. Verify each output:
1. File is non-empty (`wc -c > 0`)
2. File is valid XML (`xmllint --noout <output>.svg` exits 0)
3. File contains at least one `<g>` element (real layout output)

If any of these checks fail, fix the input `.dot` file and retry.

### manifest.json format

```json
[
  {
    "id": "dot-simple-box",
    "engine": "dot",
    "toleranceClass": "deterministic",
    "input": "test/golden/inputs/dot-simple-box.dot",
    "reference": "test/golden/refs/dot-simple-box.svg",
    "description": "Simple 3-node digraph with box nodes"
  },
  ...
]
```

Requirements:
- `id` is kebab-case, unique across all 50 entries
- `engine` is one of: `dot`, `neato`, `fdp`, `sfdp`, `circo`, `twopi`,
  `osage`, `patchwork`
- `toleranceClass` is `deterministic` for dot/circo/twopi/osage/patchwork;
  `iterative` for neato/fdp/sfdp
- Both `input` and `reference` paths are relative to the repo root
- `description` is a one-line human-readable label

### Naming convention

Input files: `test/golden/inputs/<id>.dot`
Reference files: `test/golden/refs/<id>.svg`
The `id` field in manifest.json matches the filename stem.

### Example inputs to write

Below are example descriptions for the 50 inputs. Write the actual
`.dot` content yourself — these are spec-level descriptions, not the
files.

**dot (8):**
1. `dot-simple-box`: 3-node digraph, box nodes, straight edges
2. `dot-record-node`: 2-node digraph, one record node with 3 fields
3. `dot-html-label`: 2-node digraph, HTML label with `<TABLE>`
4. `dot-cluster`: 6-node digraph with 2 clusters
5. `dot-nested-cluster`: 8-node digraph, cluster inside cluster
6. `dot-edge-styles`: 4-node digraph, edges with dashed/dotted/bold styles
7. `dot-disconnected`: two unconnected 3-node components
8. `dot-edge-dirs`: 4 edges each with different `dir` attribute value

**neato (7):**
9. `neato-simple`: 5-node undirected graph
10. `neato-weighted`: 5-node graph with `len` attributes on edges
11. `neato-diamond`: nodes shaped as diamonds
12. `neato-cluster`: graph with a cluster subgraph
13. `neato-disconnected`: two 3-node components
14. `neato-polygon`: polygon-shaped nodes with `sides=6`
15. `neato-circle`: circle-shaped nodes

**fdp (6):**
16. `fdp-simple`: 6-node undirected graph
17. `fdp-cluster`: graph with two cluster subgraphs
18. `fdp-disconnected`: two 4-node components
19. `fdp-edge-both`: edges with `dir=both`
20. `fdp-large`: 20-node graph
21. `fdp-nested-cluster`: cluster inside a cluster

**sfdp (5):**
22. `sfdp-simple`: 10-node undirected graph
23. `sfdp-medium`: 30-node undirected graph
24. `sfdp-large`: 100-node graph (stress test)
25. `sfdp-disconnected`: three 5-node components
26. `sfdp-weighted`: 15-node graph with edge weights

**circo (6):**
27. `circo-simple`: 6-node undirected cycle
28. `circo-biconn`: two triangles joined by a bridge (two BCC)
29. `circo-star`: star graph (1 center, 6 leaves)
30. `circo-html-label`: 4-node cycle with HTML label on one node
31. `circo-disconnected`: two 4-node cycles
32. `circo-record`: cycle with one record node

**twopi (6):**
33. `twopi-star`: star graph (center + 5 leaves)
34. `twopi-chain`: path graph, 5 nodes
35. `twopi-tree`: binary tree, 7 nodes
36. `twopi-root-attr`: 6-node graph with explicit `root=true` on one node
37. `twopi-disconnected`: two 3-node star graphs
38. `twopi-ranksep`: 6-node star with custom `ranksep` attribute

**osage (6):**
39. `osage-simple`: 6-node graph, two clusters
40. `osage-nested`: 8-node graph, 3 levels of cluster nesting
41. `osage-sortv`: 4-node graph with `sortv` attributes on nodes
42. `osage-array-mode`: 6-node graph with `packmode=array`
43. `osage-labels`: clusters with label attributes
44. `osage-empty-cluster`: graph with one empty cluster (DFLT_SZ case)

**patchwork (6):**
45. `patchwork-simple`: 5-node graph with equal `area` attributes
46. `patchwork-weighted`: 5-node graph with varied `area` attributes (1:4:9:16:25)
47. `patchwork-cluster`: 8-node graph with two cluster subgraphs
48. `patchwork-nested`: 10-node graph with nested clusters
49. `patchwork-default-area`: 4-node graph with no `area` attribute (default)
50. `patchwork-html-label`: patchwork graph with HTML label on one cluster

## Write-Set

- `test/golden/refs/` (50 `.svg` files)
- `test/golden/inputs/` (50 `.dot` files)
- `test/golden/manifest.json`

## Read-Set

- `~/git/graphviz/graphs/` — review for structural inspiration; do not
  copy verbatim
- `~/git/graphviz/tests/` — review for edge cases to cover
- `~/git/graphviz/docs/architecture/lib/circogen.md` — circo behavior
- `~/git/graphviz/docs/architecture/lib/twopigen.md` — twopi behavior
- `~/git/graphviz/docs/architecture/lib/osage.md` — osage behavior
- `~/git/graphviz/docs/architecture/lib/patchwork.md` — patchwork

## Architecture Decisions

No architecture decisions from the locked list apply. This task
generates static assets, not TypeScript code.

## Interface Contracts

`manifest.json` must be valid JSON according to `JSON.parse`. Each
entry must have exactly: `id`, `engine`, `toleranceClass`, `input`,
`reference`, `description`.

The `id` field must match `path.basename(entry.input, '.dot')` and
`path.basename(entry.reference, '.svg')`.

## Acceptance Criteria

1. All 8 engines represented: `jq '[.[].engine] | unique | length'
   manifest.json` returns 8.

2. HTML labels tested: at least 2 entries have input files containing
   `<TABLE` in their content. Verify: `grep -l '<TABLE' test/golden/inputs/*.dot | wc -l` ≥ 2.

3. Clusters tested: at least 6 entries have input files containing
   `cluster_` in their subgraph names. Verify:
   `grep -l 'cluster_' test/golden/inputs/*.dot | wc -l` ≥ 6.

4. All 50 reference SVGs are non-empty valid XML: running
   `xmllint --noout test/golden/refs/*.svg` exits 0 for all files, and
   `wc -c test/golden/refs/*.svg | awk '$1 > 0'` returns 50 lines.

## Observability

N/A

## Rollback

Reversible. `test/golden/inputs/` and `test/golden/refs/` are new
directories. No production code reads them.

## Quality Bar

- `JSON.parse(fs.readFileSync('test/golden/manifest.json', 'utf8'))` succeeds
- Exactly 50 entries in manifest.json
- All 50 reference SVGs pass `xmllint --noout`
- All 50 input `.dot` files parse successfully through the C binary with
  exit code 0
- At least 5 inputs per engine (enforced by manifest entry count per engine)
