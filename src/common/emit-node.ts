// SPDX-License-Identifier: EPL-2.0

/**
 * Node rendering dispatch — emit_begin_node, emit_end_node, emit_node.
 *
 * URL/map/tooltip/anchor machinery is not ported per AD-2.
 *
 * @see lib/common/emit.c:emit_begin_node (line 1643)
 * @see lib/common/emit.c:emit_end_node (line 1785)
 * @see lib/common/emit.c:emit_node (line 1797)
 */

import type { Graph } from '../model/graph.js';
import type { Node } from '../model/node.js';
import type { RenderJob } from './emit-types.js';
import type { ShapeDesc } from '../common/types.js';
import type { TextlabelT } from '../common/types.js';
import { emitLabel } from './emit-xdot.js';
import { parseStyle } from './emit-style.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read an attribute from a Map<string,string>, returning '' if absent. */
function attr(m: Map<string, string>, key: string): string {
  return m.get(key) ?? '';
}

// ---------------------------------------------------------------------------
// StyleInvisHelper — checks for invis style
// ---------------------------------------------------------------------------

/**
 * Check whether a parsed style list contains "invis".
 * @see lib/common/emit.c:emit_node (line 1819)
 */
class StyleInvisHelper {
  /** Returns true if any token in styles equals "invis". */
  static hasInvis(styles: string[]): boolean {
    for (const s of styles) {
      if (s === 'invis') return true;
    }
    return false;
  }
}

// ---------------------------------------------------------------------------
// emitBeginNode — public
// ---------------------------------------------------------------------------

/**
 * Begin rendering a node: call renderer.beginNode.
 *
 * URL/map/z machinery from the C source is not ported (AD-2).
 *
 * @see lib/common/emit.c:emit_begin_node (line 1643)
 */
export function emitBeginNode(n: Node, job: RenderJob): void {
  job.renderer.beginNode(n, job);
}

// ---------------------------------------------------------------------------
// emitEndNode — public
// ---------------------------------------------------------------------------

/**
 * End rendering a node: call renderer.endNode.
 *
 * @see lib/common/emit.c:emit_end_node (line 1785)
 */
export function emitEndNode(n: Node, job: RenderJob): void {
  job.renderer.endNode(n, job);
}

// ---------------------------------------------------------------------------
// NodeDrawHelper — emit_node sub-steps
// ---------------------------------------------------------------------------

/**
 * Determines if the node should be skipped due to style.
 * Returns true when the node has a non-empty style and "invis" is present.
 * @see lib/common/emit.c:emit_node (line 1818)
 */
class NodeDrawHelper {
  static shouldSkipStyle(n: Node): boolean {
    const style = attr(n.attrs, 'style');
    if (style.length === 0) return false;
    const tokens = parseStyle(style);
    if (tokens === null) return false;
    return StyleInvisHelper.hasInvis(tokens);
  }

  /**
   * Emit the node shape via its codefn callback.
   * @see lib/common/emit.c:emit_node line 1828
   */
  static invokeCodefn(n: Node, job: RenderJob): void {
    const shape = n.info.shape as ShapeDesc | undefined;
    if (shape !== undefined && shape.fns !== null && shape.fns.codefn !== null) {
      shape.fns.codefn(job, n);
    }
  }

  /**
   * Emit the external label if present and positioned.
   * @see lib/common/emit.c:emit_node line 1829
   */
  static emitXlabel(n: Node, job: RenderJob): void {
    const xlabel = n.info.xlabel as TextlabelT | undefined;
    if (xlabel !== undefined && xlabel.set) {
      emitLabel(xlabel, job);
    }
  }
}

// ---------------------------------------------------------------------------
// emitNode — public
// ---------------------------------------------------------------------------

/**
 * Emit all rendering for a node: style check, begin, codefn, xlabel, end.
 *
 * Layer/viewNum state tracking is not ported (AD-2).
 *
 * @see lib/common/emit.c:emit_node (line 1797)
 */
export function emitNode(n: Node, _g: Graph, job: RenderJob): void {
  const shape = n.info.shape as ShapeDesc | undefined;
  if (shape === undefined) return;
  if (NodeDrawHelper.shouldSkipStyle(n)) return;

  emitBeginNode(n, job);
  NodeDrawHelper.invokeCodefn(n, job);
  NodeDrawHelper.emitXlabel(n, job);
  emitEndNode(n, job);
}
