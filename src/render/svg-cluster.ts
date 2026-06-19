// SPDX-License-Identifier: EPL-2.0

/**
 * SVG cluster group helpers.
 * @see plugin/core/gvrender_core_svg.c:svg_begin_cluster / svg_end_cluster
 */

import type { Graph } from '../model/graph.js';
import type { RenderJob } from '../gvc/job.js';
import { escapeXml } from './svg-helpers.js';

export function svgBeginCluster(sg: Graph, job: RenderJob): void {
  job.clusterId++;
  // Layer prefix only (no per-object suffix for graph/cluster ids). @see getObjId
  job.write('<g id="' + job.idLayerPrefix() + 'clust' + job.clusterId + '" class="cluster">\n');
  job.write('<title>' + escapeXml(sg.name) + '</title>\n');
}

export function svgEndCluster(job: RenderJob): void {
  job.write('</g>\n');
}
