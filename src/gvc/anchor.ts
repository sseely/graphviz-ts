// SPDX-License-Identifier: EPL-2.0
//
// Anchor (<a xlink:href>) resolution + emission guard — the SVG-relevant half
// of lib/common/emit.c's hot-spot machinery. SVG output contains no <area>/map
// elements, so the imagemap half (map_label / map_point / url_map_p) is out of
// scope; only the gvrender_begin_anchor / gvrender_end_anchor `<a>` wraps are
// ported here. A resolver populates job.obj url/tooltip/target/id fields (which
// already exist on ObjState, mirroring obj_state_t); the emit sites read them
// and wrap the object's own graphics.
//
// @see lib/common/emit.c:emit_begin_edge (edge url/tooltip/target resolution)
// @see lib/common/emit.c:initMapData (node/graph/cluster resolution)

import type { Edge } from '../model/edge.js';
import type { Graph } from '../model/graph.js';
import type { TextlabelT } from '../common/types.js';
import type { GraphObj } from '../common/subst.js';
import { substObjAnchor, interpretCRNL } from '../common/subst.js';
import type { RendererPlugin } from './context.js';
import type { ObjState, RenderJob } from './job.js';

/** Non-empty attr value, or undefined. C: `(s = agget(o, k)) && s[0]`. */
function attr(attrs: Map<string, string>, key: string): string | undefined {
  const v = attrs.get(key);
  return v !== undefined && v !== '' ? v : undefined;
}

/** strdup_and_subst_obj: \G \N \E \H \T \L substitution for anchor data. */
function subst(s: string, obj: GraphObj): string {
  return substObjAnchor(s, obj);
}

/**
 * preprocessTooltip + strdup_and_subst_obj: interpret \n\l\r escapes, then
 * object substitution — matching the node tooltip path (poly-gencode.ts).
 * @see lib/common/emit.c:preprocessTooltip
 */
function tip(s: string, obj: GraphObj): string {
  return substObjAnchor(interpretCRNL(s), obj);
}

/** Label text of a textlabel, or null. @see device.ts:labelTextOf */
function textOf(lp: unknown): string | null {
  return (lp as TextlabelT | undefined)?.text ?? null;
}

/** Resolved component value: first non-empty key (transformed), plus whether
 *  any key was present (C's `explicit_*` flag). */
interface Picked { v: string | undefined; explicit: boolean; }

/** First present attr among keys, run through `xform`. C: the agget chains. */
function pickFirst(
  attrs: Map<string, string>,
  keys: string[],
  xform: (s: string) => string,
): Picked {
  for (const k of keys) {
    const s = attr(attrs, k);
    if (s !== undefined) return { v: xform(s), explicit: true };
  }
  return { v: undefined, explicit: false };
}

/** pickFirst with \…-substitution (urls, targets, ids). */
function pickEdge(e: Edge, keys: string[]): Picked {
  return pickFirst(e.attrs, keys, (s) => subst(s, e));
}

/** pickFirst with tooltip preprocessing (interpretCRNL + subst). */
function pickEdgeTip(e: Edge, keys: string[]): Picked {
  return pickFirst(e.attrs, keys, (s) => tip(s, e));
}

/** Apply C's `else if (dflt) … ` fallback: picked value, else dflt, else keep
 *  the field's current value. Keeps the explicit flag from the pick. */
function withFallback(
  p: Picked,
  dflt: string | null | undefined,
  current: string | null,
): { v: string | null; explicit: boolean } {
  return { v: p.v ?? dflt ?? current, explicit: p.explicit };
}

/** Edge labels (2745-2755): label, then tail/head/xlabel default to it. */
function resolveEdgeLabels(e: Edge, obj: ObjState): void {
  obj.label = textOf(e.info.label);
  obj.xlabel = textOf(e.info.xlabel) ?? obj.label;
  obj.tailLabel = textOf(e.info.tail_label) ?? obj.label;
  obj.headLabel = textOf(e.info.head_label) ?? obj.label;
}

/** Edge urls (2762-2784): components fall back to dflt (href/URL). */
function resolveEdgeUrls(e: Edge, obj: ObjState): void {
  const dflt = pickEdge(e, ['href', 'URL']).v;
  obj.url = withFallback(pickEdge(e, ['edgehref', 'edgeURL']), dflt, obj.url).v;
  obj.labelUrl = withFallback(pickEdge(e, ['labelhref', 'labelURL']), dflt, obj.labelUrl).v;
  const tail = withFallback(pickEdge(e, ['tailhref', 'tailURL']), dflt, obj.tailUrl);
  obj.tailUrl = tail.v;
  obj.explicitTailUrl = tail.explicit;
  const head = withFallback(pickEdge(e, ['headhref', 'headURL']), dflt, obj.headUrl);
  obj.headUrl = head.v;
  obj.explicitHeadUrl = head.explicit;
}

/** Edge targets (2787-2808): components fall back to dflt (target). */
function resolveEdgeTargets(e: Edge, obj: ObjState): void {
  const dflt = pickEdge(e, ['target']).v;
  const edge = withFallback(pickEdge(e, ['edgetarget']), dflt, obj.target);
  obj.target = edge.v;
  obj.explicitEdgeTarget = edge.explicit;
  obj.labelTarget = withFallback(pickEdge(e, ['labeltarget']), dflt, obj.labelTarget).v;
  const tail = withFallback(pickEdge(e, ['tailtarget']), dflt, obj.tailTarget);
  obj.tailTarget = tail.v;
  obj.explicitTailTarget = tail.explicit;
  const head = withFallback(pickEdge(e, ['headtarget']), dflt, obj.headTarget);
  obj.headTarget = head.v;
  obj.explicitHeadTarget = head.explicit;
}

/** Edge tooltips (2811-2845): explicit else default to the matching label. */
function resolveEdgeTooltips(e: Edge, obj: ObjState): void {
  const t = withFallback(pickEdgeTip(e, ['tooltip', 'edgetooltip']), obj.label, obj.tooltip);
  obj.tooltip = t.v;
  obj.explicitTooltip = t.explicit;
  const lt = withFallback(pickEdgeTip(e, ['labeltooltip']), obj.label, obj.labelTooltip);
  obj.labelTooltip = lt.v;
  obj.explicitLabelTooltip = lt.explicit;
  const tt = withFallback(pickEdgeTip(e, ['tailtooltip']), obj.tailLabel, obj.tailTooltip);
  obj.tailTooltip = tt.v;
  obj.explicitTailTooltip = tt.explicit;
  const ht = withFallback(pickEdgeTip(e, ['headtooltip']), obj.headLabel, obj.headTooltip);
  obj.headTooltip = ht.v;
  obj.explicitHeadTooltip = ht.explicit;
}

/**
 * Resolve an edge's anchor fields into job.obj, mirroring emit_begin_edge.
 * The whole-edge anchor (svg endEdge) and the per-label sub-anchors
 * (renderEdgeLabels) read these. map_* fields are not populated (SVG has no
 * maps).
 * @see lib/common/emit.c:emit_begin_edge (2706-2845)
 */
export function resolveEdgeAnchor(e: Edge, id: string, obj: ObjState): void {
  resolveEdgeLabels(e, obj);
  resolveEdgeUrls(e, obj);
  resolveEdgeTargets(e, obj);
  resolveEdgeTooltips(e, obj);
  obj.id = subst(id, e);
}

/**
 * Resolve a graph or cluster's anchor fields into job.obj: url from href/URL,
 * tooltip from tooltip else default to the object's label, target, id.
 * @see lib/common/emit.c:initMapData (163-200)
 */
export function resolveObjAnchor(
  g: Graph,
  label: string | null,
  id: string,
  obj: ObjState,
): void {
  const a = g.attrs;
  obj.label = label;
  const url = attr(a, 'href') ?? attr(a, 'URL');
  if (url !== undefined) obj.url = subst(url, g);
  const tt = attr(a, 'tooltip');
  if (tt !== undefined) { obj.tooltip = tip(tt, g); obj.explicitTooltip = true; }
  else if (label !== null) obj.tooltip = label;
  const tgt = attr(a, 'target');
  if (tgt !== undefined) obj.target = subst(tgt, g);
  obj.id = subst(id, g);
}

/**
 * Open an anchor with explicit fields, coalescing nullable url/tooltip/target
 * to ''. The id is passed through (callers build label-specific ids).
 * @see lib/common/emit.c → gvrender_begin_anchor
 */
export function openAnchorWith(
  renderer: RendererPlugin,
  job: RenderJob,
  url: string | null,
  tooltip: string | null,
  target: string | null,
  id: string,
): void {
  renderer.beginAnchor?.(url ?? '', tooltip ?? '', target ?? '', id, job);
}

/**
 * Open the whole-object anchor when there is a url or an explicit tooltip,
 * mirroring `if (obj->url || obj->explicit_tooltip)`. Returns true when the
 * caller must close it with renderer.endAnchor after the object's own graphics.
 * @see lib/common/emit.c:2877 (edge), 3653 (graph), 3803 (cluster)
 */
export function beginAnchorIf(renderer: RendererPlugin, job: RenderJob): boolean {
  const obj = job.obj;
  if (obj === null || (obj.url === null && !obj.explicitTooltip)) return false;
  openAnchorWith(renderer, job, obj.url, obj.tooltip, obj.target, obj.id ?? '');
  return true;
}
