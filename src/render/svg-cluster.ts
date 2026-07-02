// SPDX-License-Identifier: EPL-2.0

/**
 * SVG cluster group helpers.
 * @see plugin/core/gvrender_core_svg.c:svg_begin_cluster / svg_end_cluster
 */

import type { Graph } from '../model/graph.js';
import type { RenderJob } from '../gvc/job.js';
import { escapeXmlTitle } from './svg-helpers.js';
import { svgClusterId, svgClusterClass } from './svg-id.js';

export function svgBeginCluster(sg: Graph, job: RenderJob): void {
  // Id from getObjId (DOT `id` attr / gid prefix / clust<seq>); layer prefix
  // only (no per-object suffix for graph/cluster ids). DOT `class` is appended.
  // @see lib/common/emit.c:getObjId; plugin/core/gvrender_core_svg.c:svg_print_id_class
  job.write('<g id="' + job.idLayerPrefix() + svgClusterId(sg, job)
    + '" ' + svgClusterClass(sg) + '>\n');
  job.write('<title>' + escapeXmlTitle(sg.name) + '</title>\n');
}

export function svgEndCluster(job: RenderJob): void {
  job.write('</g>\n');
}
