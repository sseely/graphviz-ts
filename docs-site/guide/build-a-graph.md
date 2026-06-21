# Build a graph in code

`createGraph` constructs an in-memory graph without writing DOT source. Use it
when the graph structure comes from your application's data model rather than a
static DOT string.

## Basic usage

```ts
import { createGraph, render } from 'graphviz-ts';

const b = createGraph({ directed: true });

const a = b.addNode('a', { shape: 'box', label: 'Start' });
const c = b.addNode('c', { label: 'End' });

b.addEdge(a, c, { label: 'goes to' });
// Nodes can also be referenced by name string:
b.addEdge('a', 'c', { style: 'dashed' });

const svg = render(b.graph, 'svg');
```

`createGraph` returns a `GvGraphBuilder`. Its `.graph` property is the opaque
`Graph` object accepted by `render`, `getLayout`, and `getDrawOps`.

## Options

```ts
createGraph(opts?: {
  directed?: boolean;  // default true
  strict?:   boolean;  // default false — strict graph forbids multi-edges
  name?:     string;   // graph name, default ''
}): GvGraphBuilder
```

## Builder methods

| Method | Description |
|---|---|
| `addNode(name, attrs?)` | Add a node; returns a `GvNode` handle |
| `addEdge(tail, head, attrs?)` | Add an edge; `tail`/`head` can be a `GvNode` handle or a name string |
| `addSubgraph(name, attrs?)` | Add a named subgraph; returns a nested `GvGraphBuilder` |
| `setAttr(k, v)` | Set a graph-level attribute |
| `getAttr(k)` | Read a graph-level attribute |
| `.graph` | The underlying `Graph` (opaque handle for layout/render) |

## Attributes

Pass DOT attribute key/value pairs as plain objects:

```ts
b.addNode('server', { shape: 'cylinder', fillcolor: '#d0e8ff', style: 'filled' });
b.setAttr('rankdir', 'LR');
```

Any valid DOT attribute is accepted; graphviz-ts passes them through to the
layout engine unchanged.

## Subgraphs

`addSubgraph` returns a builder scoped to the subgraph. Nodes added to a
subgraph are also members of the root graph:

```ts
const b = createGraph({ directed: true, name: 'pipeline' });

const cluster = b.addSubgraph('cluster_build', { label: 'CI', style: 'filled' });
cluster.addNode('compile');
cluster.addNode('test');
cluster.addEdge('compile', 'test');

b.addNode('deploy');
b.addEdge('test', 'deploy');

const svg = render(b.graph, 'svg');
```

## Compared with `parse`

```ts
// DOT string — convenient for static graphs
import { parse, render } from 'graphviz-ts';
const g = parse('digraph { a -> b }');
const svg = render(g, 'svg');

// Builder — convenient when graph structure comes from code
import { createGraph, render } from 'graphviz-ts';
const b = createGraph();
b.addEdge('a', 'b');
const svg2 = render(b.graph, 'svg');
```

Both `parse` and `createGraph` produce a `Graph` that can be passed to
`render`, `getLayout`, and `getDrawOps` identically.
