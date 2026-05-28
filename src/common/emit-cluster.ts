// SPDX-License-Identifier: EPL-2.0

/**
 * Cluster rendering dispatch — emitBeginCluster, emitEndCluster, emitClusters.
 *
 * URL/map/tooltip/anchor machinery is not ported per AD-2.
 * round_corners is not ported (shape rendering batch).
 * stripedBox is stubbed in emit-shape.ts.
 *
 * @see lib/common/emit.c:emit_begin_cluster (line 3758)
 * @see lib/common/emit.c:emit_end_cluster (line 3772)
 * @see lib/common/emit.c:emit_clusters (line 3777)
 */

import type { Graph } from '../model/graph.js';
import type { Box, Point } from '../model/geom.js';
import type { RenderJob } from './emit-types.js';
import type { GraphvizPolygonStyle } from '../common/types.js';
import type { TextlabelT } from '../common/types.js';
import { emitLabel } from './emit-xdot.js';
import { parseStyle } from './emit-style.js';
import { findStopColor } from './emit-style.js';
import { DEFAULT_COLOR, DEFAULT_FILL } from './emit-xdot.js';

// ---------------------------------------------------------------------------
// GUI state constants — @see lib/common/types.h:GUI_STATE_*
// ---------------------------------------------------------------------------

const GUI_STATE_ACTIVE = 1 << 0;
const GUI_STATE_SELECTED = 1 << 1;
const GUI_STATE_DELETED = 1 << 3;
const GUI_STATE_VISITED = 1 << 2;

// ---------------------------------------------------------------------------
// Fill constants — @see lib/common/const.h
// ---------------------------------------------------------------------------

/** Filled with solid color. @see lib/common/const.h:FILL */
const FILL = 1;
/** Linear gradient fill. @see lib/common/const.h:GRADIENT */
const GRADIENT = 2;
/** Radial gradient fill. @see lib/common/const.h:RGRADIENT */
const RGRADIENT = 3;

// ---------------------------------------------------------------------------
// emitBeginCluster — public
// ---------------------------------------------------------------------------

/**
 * Begin rendering a cluster subgraph.
 * @see lib/common/emit.c:emit_begin_cluster (line 3758)
 */
export function emitBeginCluster(sg: Graph, job: RenderJob): void {
  job.renderer.beginCluster(sg, job);
}

// ---------------------------------------------------------------------------
// emitEndCluster — public
// ---------------------------------------------------------------------------

/**
 * End rendering a cluster subgraph.
 * @see lib/common/emit.c:emit_end_cluster (line 3772)
 */
export function emitEndCluster(sg: Graph, job: RenderJob): void {
  job.renderer.endCluster(sg, job);
}

// ---------------------------------------------------------------------------
// Helpers — attrs Map accessor
// ---------------------------------------------------------------------------

/** Read an attribute from a Map<string,string>, returning '' if absent. */
function attr(m: Map<string, string>, key: string): string {
  return m.get(key) ?? '';
}

// ---------------------------------------------------------------------------
// ClusterStyleHelper — parse and extract polygon style flags
// ---------------------------------------------------------------------------

/**
 * Parse a cluster's style attribute and populate a GraphvizPolygonStyle.
 * Mirrors checkClusterStyle in emit.c.
 *
 * @see lib/common/emit.c:checkClusterStyle (line 367)
 */
class ClusterStyleHelper {
  static parse(sg: Graph): {
    style: GraphvizPolygonStyle;
    tokens: string[] | null;
  } {
    const raw = attr(sg.attrs, 'style');
    if (raw.length === 0) {
      return { style: ClusterStyleHelper.zero(), tokens: null };
    }
    const tokens = parseStyle(raw);
    if (tokens === null) {
      return { style: ClusterStyleHelper.zero(), tokens: null };
    }
    return { style: ClusterStyleHelper.fromTokens(tokens), tokens };
  }

  private static zero(): GraphvizPolygonStyle {
    return {
      filled: false, radial: false, striped: false, rounded: false,
      diagonals: false, wedged: false, auxlabels: false, invisible: false,
      dotted: false, dashed: false, underline: false, fixedshape: false,
      shape: 0,
    };
  }

  private static fromTokens(tokens: string[]): GraphvizPolygonStyle {
    const s = ClusterStyleHelper.zero();
    for (const t of tokens) {
      if (t === 'filled') { s.filled = true; }
      else if (t === 'radial') { s.filled = true; s.radial = true; }
      else if (t === 'striped') { s.striped = true; }
      else if (t === 'rounded') { s.rounded = true; }
    }
    return s;
  }
}

// ---------------------------------------------------------------------------
// GuiStateColor — resolve override color for GUI state flags
// ---------------------------------------------------------------------------

/**
 * Return the override color for an active GUI state, or null if none.
 * Extracted to reset CCN for callers.
 *
 * @see lib/common/types.h:GUI_STATE_* constants
 */
class GuiStateColor {
  static resolve(gs: number): string | null {
    if (gs & GUI_STATE_ACTIVE) return '#ff0000';
    if (gs & GUI_STATE_SELECTED) return '#0000ff';
    if (gs & GUI_STATE_DELETED) return '#999999';
    if (gs & GUI_STATE_VISITED) return '#00bb00';
    return null;
  }
}

// ---------------------------------------------------------------------------
// ClusterColorHelper — resolve pen/fill colors for a cluster
// ---------------------------------------------------------------------------

/**
 * Resolve pen and fill colors, accounting for GUI state overrides.
 *
 * @see lib/common/emit.c:emit_clusters color resolution (line 3812)
 */
class ClusterColorHelper {
  static resolvePen(sg: Graph): string {
    const override = GuiStateColor.resolve(sg.info.gui_state);
    if (override !== null) return override;
    const pen = attr(sg.attrs, 'pencolor') || attr(sg.attrs, 'color');
    return pen.length > 0 ? pen : DEFAULT_COLOR;
  }

  static resolveFill(sg: Graph): string {
    const override = GuiStateColor.resolve(sg.info.gui_state);
    if (override !== null) return override;
    const fill =
      attr(sg.attrs, 'fillcolor') ||
      attr(sg.attrs, 'bgcolor') ||
      attr(sg.attrs, 'color');
    return fill.length > 0 ? fill : DEFAULT_FILL;
  }
}

// ---------------------------------------------------------------------------
// ClusterFillHelper — resolve fill mode (solid vs gradient) and set colors
// ---------------------------------------------------------------------------

/**
 * Set renderer fill/pen colors for a cluster, handling gradient color lists.
 * @see lib/common/emit.c:emit_clusters fill block (line 3855)
 */
class ClusterFillHelper {
  /**
   * Apply fill colors. Returns the effective fill mode (FILL, GRADIENT, etc.)
   */
  static applyFill(
    _sg: Graph,
    fillcolor: string,
    pencolor: string,
    istyle: GraphvizPolygonStyle,
    job: RenderJob,
  ): number {
    const clrs: [string | null, string | null] = [null, null];
    const frac = { value: 0 };
    if (findStopColor(fillcolor, clrs, frac)) {
      job.renderer.fillColor(clrs[0] ?? fillcolor, job);
      return istyle.radial ? RGRADIENT : GRADIENT;
    }
    job.renderer.fillColor(fillcolor, job);
    job.renderer.penColor(pencolor, job);
    return FILL;
  }
}

// ---------------------------------------------------------------------------
// ClusterBoxHelper — emit the cluster boundary box
// ---------------------------------------------------------------------------

/**
 * Box corners from a Box, ordered CCW with LL=pts[0].
 * pts[0]=LL, pts[1]=(UR.x,LL.y), pts[2]=UR, pts[3]=(LL.x,UR.y)
 */
function boxCorners(bb: Box): [Point, Point, Point, Point] {
  const ll = bb.ll;
  const ur = bb.ur;
  return [
    { x: ll.x, y: ll.y },
    { x: ur.x, y: ll.y },
    { x: ur.x, y: ur.y },
    { x: ll.x, y: ur.y },
  ];
}

/**
 * Emit the cluster boundary box with the appropriate fill mode.
 * @see lib/common/emit.c:emit_clusters box rendering (line 3908)
 */
class ClusterBoxHelper {
  static emit(
    sg: Graph,
    pencolor: string,
    fillMode: number,
    job: RenderJob,
  ): void {
    const bb = sg.info.bb;
    const peripheriesStr = attr(sg.attrs, 'peripheries');
    const peripheries = peripheriesStr.length > 0 ? Number(peripheriesStr) : 1;
    if (peripheries === 0 && fillMode === 0) return;
    job.renderer.penColor(peripheries > 0 ? pencolor : 'transparent', job);
    const pts = boxCorners(bb);
    job.renderer.polygon(pts, fillMode !== 0, job);
  }
}

// ---------------------------------------------------------------------------
// ClusterDrawHelper — orchestrate one cluster's draw pass
// ---------------------------------------------------------------------------

/**
 * Draw a single cluster: style, colors, box, label.
 * @see lib/common/emit.c:emit_clusters inner body
 */
class ClusterDrawHelper {
  static draw(sg: Graph, job: RenderJob): void {
    const { style: istyle } = ClusterStyleHelper.parse(sg);
    const pencolor = ClusterColorHelper.resolvePen(sg);
    const fillcolor = ClusterColorHelper.resolveFill(sg);

    let fillMode = 0;
    if (istyle.filled) {
      fillMode = ClusterFillHelper.applyFill(sg, fillcolor, pencolor, istyle, job);
    } else {
      job.renderer.penColor(pencolor, job);
    }

    ClusterBoxHelper.emit(sg, pencolor, fillMode, job);

    const lab = sg.info.label as TextlabelT | undefined;
    if (lab !== undefined) emitLabel(lab, job);
  }
}

// ---------------------------------------------------------------------------
// emitClusters — public
// ---------------------------------------------------------------------------

/**
 * Emit all clusters in graph g, recursing depth-first.
 *
 * EMIT_CLUSTERS_LAST and EMIT_PREORDER flags are not ported (AD-2).
 * The C source uses 1-indexed clust[1..n_cluster]; TypeScript clust[] is
 * 0-indexed per graphInfo.ts contract.
 *
 * @see lib/common/emit.c:emit_clusters (line 3777)
 */
export function emitClusters(g: Graph, job: RenderJob): void {
  const nCluster = g.info.n_cluster ?? 0;
  const clust = g.info.clust;
  if (nCluster === 0 || clust === undefined) return;

  for (let c = 0; c < nCluster; c++) {
    const sg = clust[c];
    if (sg === undefined) continue;
    emitClusters(sg, job);
    emitBeginCluster(sg, job);
    ClusterDrawHelper.draw(sg, job);
    emitEndCluster(sg, job);
  }
}
