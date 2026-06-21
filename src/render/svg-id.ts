// SPDX-License-Identifier: EPL-2.0
//
// SVG object id + class resolution, faithful to C's getObjId
// (lib/common/emit.c:209) and svg_print_id_class
// (plugin/core/gvrender_core_svg.c). A non-empty DOT `id` attribute wins
// verbatim; otherwise the generated `<pfx><seq>` id is used, with a `<gid>_`
// prefix on non-root objects when the root graph carries an `id` attribute
// (job.drawingId). The DOT `class` attribute, when present, is appended to the
// SVG class string. Attribute reads use C's `agget` semantics (defaults
// inherited) via nodeAttr / clusterAttr.

import type { Node } from '../model/node.js';
import type { Edge } from '../model/edge.js';
import type { Graph } from '../model/graph.js';
import type { RenderJob } from '../gvc/job.js';
import { escapeXml } from './xml-escape.js';
import { nodeAttr } from '../common/poly-init.js';
import { clusterAttr } from '../gvc/device-cluster.js';

/**
 * `class="<kind>"`, with the DOT `class` attribute appended (` <class>`,
 * xml-escaped) when present — mirroring svg_print_id_class.
 * @see plugin/core/gvrender_core_svg.c:svg_print_id_class
 */
export function svgClass(kind: string, classAttr: string | undefined): string {
  return classAttr !== undefined && classAttr.length > 0
    ? 'class="' + kind + ' ' + escapeXml(classAttr) + '"'
    : 'class="' + kind + '"';
}

// getObjId reads the object's OWN `id` (agget returns "" for a subgraph/node
// that has no id set unless the `id` attribute was declared before the object
// was created — a cgraph declaration-order quirk we do not model). Using the
// own id avoids over-inheriting the root graph's id, which the gid prefix
// already supplies separately. @see lib/common/emit.c:getObjId

/** SVG id for a node: own DOT `id` attr, else `node<seq>` (with gid prefix). */
export function svgNodeId(n: Node, job: RenderJob): string {
  return job.objId(n.attrs.get('id'), 'node' + (n.id + 1));
}

/** SVG id for an edge: own DOT `id` attr, else `edge<graphSeq>` (gid prefix). */
export function svgEdgeId(e: Edge, job: RenderJob): string {
  return job.objId(e.attrs.get('id'), 'edge' + e.graphSeq);
}

/** SVG id for a cluster: own DOT `id` attr, else `clust<clusterId>` (gid prefix). */
export function svgClusterId(sg: Graph, job: RenderJob): string {
  return job.objId(sg.attrs.get('id'), 'clust' + job.clusterId);
}

/** SVG id for the root graph group: DOT `id` attr, else `graph0` (no prefix). */
export function svgGraphId(g: Graph, job: RenderJob): string {
  return job.objId(g.attrs.get('id'), 'graph0', true);
}

/** `class="node[ <class>]"`, reading the inherited DOT `class` attribute. */
export function svgNodeClass(n: Node): string {
  return svgClass('node', nodeAttr(n, n.root, 'class'));
}

/** `class="edge[ <class>]"`. */
export function svgEdgeClass(e: Edge): string {
  return svgClass('edge', e.attrs.get('class'));
}

/** `class="cluster[ <class>]"`, reading the inherited cluster `class` attr. */
export function svgClusterClass(sg: Graph): string {
  return svgClass('cluster', clusterAttr(sg, 'class'));
}

/** `class="graph[ <class>]"`. */
export function svgGraphClass(g: Graph): string {
  return svgClass('graph', g.attrs.get('class'));
}
