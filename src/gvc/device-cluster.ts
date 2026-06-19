// SPDX-License-Identifier: EPL-2.0
//
// Cluster label + fill/pen state helpers, split from device.ts (file-size cap).
// These are leaf helpers with no dependency on the device render loop;
// renderOneCluster (in device.ts) drives them.

import type { Graph } from '../model/graph.js';
import type { RendererPlugin } from './context.js';
import type { ObjState } from './job.js';
import { RenderJob } from './job.js';
import { FillType } from './context.js';
import type { TextlabelT } from '../common/types.js';
import type { TextSpan } from '../common/emit-types.js';
import type { PlacedHtml } from '../common/htmltable-pos.js';
import { emitHtmlLabel } from '../common/htmltable-emit.js';
import type { ResolvedFill, ClusterAttrs } from '../common/style-resolve.js';
import {
  parseStyleFlags, resolvePenColor, resolvePenType, resolvePenWidth,
  resolveClusterFillEx,
} from '../common/style-resolve.js';
import { resolveRenderColor, withColorScheme } from '../render/color-resolve.js';

/**
 * Render a cluster's label (HTML or text spans).
 * @see lib/common/labels.c:emit_label
 */
export function renderClusterLabel(sg: Graph, renderer: RendererPlugin, job: RenderJob): void {
  const lab = sg.info.label as TextlabelT | undefined;
  if (!lab?.set) return;
  if (lab.html) {
    if (lab.u.kind === 'html') {
      emitHtmlLabel(lab.u.html as PlacedHtml, lab.pos, renderer, job);
    }
    return;
  }
  if (lab.u.kind !== 'txt' || lab.u.nspans <= 0) return;
  const py = lab.pos.y + lab.dimen.y / 2.0 - lab.fontsize;
  for (let i = 0; i < lab.u.nspans; i++) {
    const span = lab.u.span[i] as TextSpan | undefined;
    if (!span) break;
    renderer.textspan({ x: lab.pos.x, y: py }, span, job);
  }
}

/**
 * Copy gradient fields from a linear/radial ResolvedFill onto obj.
 * @see lib/common/emit.c:emit_clusters:3857-3869 GRADIENT/RGRADIENT block
 */
function applyClusterGradient(
  obj: ObjState,
  fill: Extract<ResolvedFill, { kind: 'linear' | 'radial' }>,
): void {
  obj.fill = fill.kind === 'radial' ? FillType.Radial : FillType.Linear;
  obj.fillColor = resolveRenderColor(fill.fillColor);
  obj.stopColor = resolveRenderColor(fill.stopColor);
  obj.gradientFrac = fill.frac;
  obj.gradientAngle = fill.angle;
}

/** Apply pen state (color, width, type) to a cluster obj from attrs.
 * @see lib/common/emit.c:emit_clusters:3835-3840 */
function applyClusterPenState(obj: ObjState, sg: Graph): void {
  const flags = parseStyleFlags(sg.attrs.get('style'));
  const pen = sg.attrs.get('pencolor') ?? sg.attrs.get('color');
  obj.penColor = resolveRenderColor(resolvePenColor(pen));
  obj.penWidth = resolvePenWidth(flags, sg.attrs.get('penwidth'));
  obj.pen = resolvePenType(flags);
}

/** Build the ClusterAttrs bag from a subgraph's attrs map. */
function clusterAttrsOf(sg: Graph): ClusterAttrs {
  return {
    style: sg.attrs.get('style'),
    color: sg.attrs.get('color'),
    pencolor: sg.attrs.get('pencolor'),
    fillcolor: sg.attrs.get('fillcolor'),
    bgcolor: sg.attrs.get('bgcolor'),
    penwidth: sg.attrs.get('penwidth'),
    gradientangle: sg.attrs.get('gradientangle'),
  };
}

/**
 * Apply cluster fill/pen state to job.obj from resolved cluster attrs.
 * @see lib/common/emit.c:emit_clusters:3805-3874
 */
export function applyClusterObjState(sg: Graph, job: RenderJob): boolean {
  const fillRes = resolveClusterFillEx(clusterAttrsOf(sg));
  if (job.obj === null) return false;
  const obj = job.obj;
  // C wraps the cluster color block with setColorScheme. @see emit.c:3800/3943
  return withColorScheme(sg.attrs.get('colorscheme'), () => {
    applyClusterPenState(obj, sg);
    if (fillRes.kind === 'none') { obj.fill = FillType.None; return false; }
    if (fillRes.kind === 'solid') {
      obj.fill = FillType.Solid;
      obj.fillColor = resolveRenderColor(fillRes.color);
      return true;
    }
    applyClusterGradient(obj, fillRes);
    return true;
  });
}
