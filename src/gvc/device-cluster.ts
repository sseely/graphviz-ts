// SPDX-License-Identifier: EPL-2.0
//
// Cluster fill/pen state helpers, split from device.ts (file-size cap).
// These are leaf helpers with no dependency on the device render loop;
// renderOneCluster (in device.ts) drives them.

import type { Graph } from '../model/graph.js';
import type { ObjState } from './job.js';
import { RenderJob } from './job.js';
import { FillType } from './context.js';
import type { ResolvedFill, ClusterAttrs } from '../common/style-resolve.js';
import {
  parseStyleFlags, resolvePenColor, resolvePenType, resolvePenWidth,
  resolveClusterFillEx,
} from '../common/style-resolve.js';
import { resolveRenderColor, withColorScheme } from '../render/color-resolve.js';

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

/**
 * Read a cluster graph-attribute with ancestor inheritance (agxget): a cluster
 * with no value of its own inherits an ancestor's `graph[key=...]`. C resolves
 * every cluster attr this way (late_string(sg, agfindgraphattr(sg, key), ...)),
 * so a root-level style/color/pencolor/fillcolor/bgcolor/penwidth/gradientangle
 * applies to the cluster boundary as the oracle does.
 * @see lib/common/emit.c:emit_clusters (cluster attrs via agxget)
 */
export function clusterAttr(sg: Graph, key: string): string | undefined {
  for (let g: Graph | null = sg; g !== null; g = g.parent) {
    const v = g.attrs.get(key);
    if (v !== undefined) return v;
  }
  return undefined;
}

/** Cluster `style` with ancestor inheritance. @see clusterAttr */
export function clusterStyle(sg: Graph): string | undefined {
  return clusterAttr(sg, 'style');
}

/**
 * Cluster `peripheries`, mirroring `late_int(sg, G_peripheries, 1, 0)`:
 * default 1, non-numeric → default, clamped to a minimum of 0.
 * @see lib/common/emit.c:3878
 */
export function clusterPeripheries(sg: Graph): number {
  const raw = clusterAttr(sg, 'peripheries');
  if (raw === undefined || raw.length === 0) return 1;
  const v = parseInt(raw, 10);
  if (Number.isNaN(v)) return 1;
  return v < 0 ? 0 : v;
}

/** Apply pen state (color, width, type) to a cluster obj from attrs.
 * `peripheries=0` suppresses the boundary stroke: C sets pencolor
 * "transparent" (the box is still drawn for fill).
 * @see lib/common/emit.c:emit_clusters:3835-3840, 3907-3917 */
function applyClusterPenState(obj: ObjState, sg: Graph): void {
  const flags = parseStyleFlags(clusterStyle(sg));
  const pen = clusterAttr(sg, 'pencolor') ?? clusterAttr(sg, 'color');
  obj.penColor = clusterPeripheries(sg) === 0
    ? resolveRenderColor('transparent')
    : resolveRenderColor(resolvePenColor(pen));
  obj.penWidth = resolvePenWidth(flags, clusterAttr(sg, 'penwidth'));
  obj.pen = resolvePenType(flags);
}

/** Build the ClusterAttrs bag from a subgraph's attrs, with inheritance. */
function clusterAttrsOf(sg: Graph): ClusterAttrs {
  return {
    style: clusterStyle(sg),
    color: clusterAttr(sg, 'color'),
    pencolor: clusterAttr(sg, 'pencolor'),
    fillcolor: clusterAttr(sg, 'fillcolor'),
    bgcolor: clusterAttr(sg, 'bgcolor'),
    penwidth: clusterAttr(sg, 'penwidth'),
    gradientangle: clusterAttr(sg, 'gradientangle'),
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
  return withColorScheme(clusterAttr(sg, 'colorscheme'), () => {
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
