# Cluster-carry reference implementation (proven tsc-clean)

This is the cluster-carry half of T3, implemented and tsc-verified during
`fix-pack-dot-2458` (then reverted because the cluster mincross core crashes —
see README cascade map). It is the easy half; drop it back into
`src/layout/dot/pack-components.ts` and pair it with the cascade fixes.

Wiring in `doDot` (`src/layout/dot/index.ts`) — replace the `cccomps` call +
`graphHasCluster` guard with:

```ts
import { ratioIsNone, layoutAndPack, cccompsWithClusters } from './pack-components.js';
// ...
const { comps, origOf } = cccompsWithClusters(g);
if (comps.length === 1) {
  dotLayoutPipeline(g);
} else if (ratioIsNone(g)) {
  pinfo.doSplines = true;
  layoutAndPack(g, comps, pinfo, origOf);   // layoutAndPack gains an origOf param
} else {
  dotLayoutPipeline(g);
}
```

`layoutAndPack` gains `origOf: Map<Graph, Graph>` and calls
`copyClusterInfo(comps, root, origOf)` (replacing the T2 stub) after
`packSubgraphs` + `shiftComponentArrowOps`, before `gvPostprocess(root)`.

## Decomposition + projection (C cccomps + projectG/subgInduce)

```ts
import { packSubgraphs, buildSubgraph } from '../pack/index.js';
import { agsubg } from '../../model/cgraph-ops.js';
import { dotRank, isACluster } from './rank.js';
import type { Node } from '../../model/node.js';

function ufFindName(parent: Map<string, string>, x: string): string {
  let r = x;
  while (parent.get(r) !== r) r = parent.get(r)!;
  let c = x;
  while (parent.get(c) !== r) { const n = parent.get(c)!; parent.set(c, r); c = n; }
  return r;
}
function ufUnionName(parent: Map<string, string>, a: string, b: string): void {
  const ra = ufFindName(parent, a), rb = ufFindName(parent, b);
  if (ra !== rb) parent.set(ra, rb);
}
function collectClusters(g: Graph, out: Graph[]): void {
  for (const sg of g.subgraphs.values()) {
    if (isACluster(sg)) out.push(sg);
    collectClusters(sg, out);
  }
}

/** C projectG: clone sub's nodes-in-target into a subgraph of target. */
function projectOne(sub: Graph, target: Graph, origOf: Map<Graph, Graph>): Graph | null {
  let proj: Graph | null = null;
  for (const n of sub.nodes.values()) {
    if (target.nodes.get(n.name) !== n) continue;
    if (proj === null) { proj = agsubg(target, sub.name, true)!; proj.attrs = new Map(sub.attrs); }
    proj.nodes.set(n.name, n);
  }
  if (proj !== null && isACluster(proj)) origOf.set(proj, sub); // ORIG_REC
  return proj;
}
/** C subgInduce: project ALL subgraphs (clusters + rank=same) recursively. */
function projectSubgraphs(origParent: Graph, target: Graph, origOf: Map<Graph, Graph>): void {
  for (const sub of origParent.subgraphs.values()) {
    const proj = projectOne(sub, target, origOf);
    if (proj !== null) projectSubgraphs(sub, proj, origOf);
  }
}

/** C cccomps: connected by edge OR shared cluster; carry cluster clones. */
export function cccompsWithClusters(root: Graph): { comps: Graph[]; origOf: Map<Graph, Graph> } {
  const parent = new Map<string, string>();
  for (const n of root.nodes.values()) parent.set(n.name, n.name);
  for (const e of root.edges) ufUnionName(parent, e.tail.name, e.head.name);
  const clusters: Graph[] = [];
  collectClusters(root, clusters);
  for (const cl of clusters) {
    let prev: string | undefined;
    for (const n of cl.nodes.values()) {
      if (prev !== undefined) ufUnionName(parent, prev, n.name);
      prev = n.name;
    }
  }
  const groups = new Map<string, Node[]>();
  for (const n of root.nodes.values()) {
    const r = ufFindName(parent, n.name);
    const g = groups.get(r); if (g) g.push(n); else groups.set(r, [n]);
  }
  const origOf = new Map<Graph, Graph>();
  const comps: Graph[] = [];
  let idx = 0;
  for (const nodes of groups.values()) {
    const comp = buildSubgraph(root, nodes, `_cc_${idx++}`);
    projectSubgraphs(root, comp, origOf);
    comps.push(comp);
  }
  return { comps, origOf };
}
```

## Copy-back (C copyCluster / copyClusterInfo / mapClust)

```ts
import type { Point } from '../../model/geom.js';

function mapClust(clone: Graph, origOf: Map<Graph, Graph>): Graph {
  const orig = origOf.get(clone);
  if (orig === undefined) throw new Error(`mapClust: no original for ${clone.name}`);
  return orig;
}
function copyCluster(scl: Graph, cl: Graph, origOf: Map<Graph, Graph>): void {
  cl.info.bb = scl.info.bb;
  cl.info.label_pos = scl.info.label_pos;
  if (scl.info.border !== undefined) cl.info.border = [...scl.info.border] as [Point, Point, Point, Point];
  const nclust = scl.info.n_cluster ?? 0;
  cl.info.n_cluster = nclust;
  cl.info.clust = [];
  for (let j = 1; j <= nclust; j++) {
    const childClone = scl.info.clust![j - 1];
    const childOrig = mapClust(childClone, origOf);
    cl.info.clust[j - 1] = childOrig;
    copyCluster(childClone, childOrig, origOf);
  }
  cl.info.label = scl.info.label;
  scl.info.label = undefined; // C: GD_label(scl) = NULL
}
export function copyClusterInfo(comps: Graph[], root: Graph, origOf: Map<Graph, Graph>): void {
  let nclust = 0;
  for (const sg of comps) nclust += sg.info.n_cluster ?? 0;
  root.info.n_cluster = nclust;
  root.info.clust = [];
  let idx = 0;
  for (const sg of comps) {
    const nc = sg.info.n_cluster ?? 0;
    for (let j = 1; j <= nc; j++) {
      const clone = sg.info.clust![j - 1];
      const orig = mapClust(clone, origOf);
      root.info.clust[idx++] = orig;
      copyCluster(clone, orig, origOf);
    }
  }
}
```

## Notes

- `collapseSets(comp, comp)` (clType LOCAL) discovers the cloned clusters/rank=same
  sets from `comp.subgraphs`, so `comp.info.clust` ends up holding the clone
  objects — which `origOf` maps back. (Confirmed by tracing `dot1Rank`.)
- `device.ts:381` renders clusters from `root.info.clust`; `copyClusterInfo`
  populating it drives cluster emit at packed positions. `gvPostprocess` →
  `translateBb` recurses `root.info.clust` to rotate cluster bbs.
- `shiftGraphBBs` (pack module) already shifts each component's `info.clust` bbs
  during packing, so copy-back reads the packed clone bb.
- Arrow ops for cluster-component edges are handled by the existing
  `shiftComponentArrowOps`.
- The blocker is purely the cluster mincross core (README cascade map), not this
  carry code.
```
