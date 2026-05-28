// SPDX-License-Identifier: EPL-2.0

/**
 * GVC context and plugin registry.
 *
 * Ports GVC_t / GVC_s (lib/gvc/gvcint.h) and the plugin capability
 * negotiation order from lib/gvc/gvplugin.c.  libltdl dynamic loading
 * is replaced by static registration (AD-2).
 *
 * renderToString is NOT on GvcContext — it lives in src/gvc/device.ts as
 * render(ctx, g, format) to avoid a circular import: device.ts imports
 * GvcContext, so GvcContext cannot import device.ts.
 *
 * @see lib/gvc/gvcint.h
 * @see lib/gvc/gvplugin.c:gvplugin_install
 * @see lib/gvc/gvcjob.h
 */

import type { Graph } from '../model/graph.js';
import type { Node } from '../model/node.js';
import type { Edge } from '../model/edge.js';
import type { Point } from '../model/geom.js';
import type { TextSpan } from '../common/emit-types.js';
import type { TextMeasurer } from '../common/textmeasure.js';
import type { DebugOptions } from '../debug.js';
import type { RenderJob } from './job.js';  // scaffold in T25; full class in T26

// ---------------------------------------------------------------------------
// Enums — match C definitions in lib/gvc/gvcjob.h exactly
// ---------------------------------------------------------------------------

/** @see lib/gvc/gvcjob.h:label_type */
export const enum LabelType { Plain = 0, Html = 1 }

/** @see lib/gvc/gvcjob.h:pen_type */
export const enum PenType { None = 0, Dashed = 1, Dotted = 2, Solid = 3 }

/** @see lib/gvc/gvcjob.h:fill_type */
export const enum FillType { None = 0, Solid = 1, Linear = 2, Radial = 3 }

// ---------------------------------------------------------------------------
// RendererPlugin interface
// ---------------------------------------------------------------------------

/**
 * Fused equivalent of gvplugin_installed_t + gvrender_engine_s vtable.
 *
 * AD-2 collapses the two-step install/load into one self-contained object.
 * Plugins are registered with GvcContext.register() and selected by
 * bestRenderer() using the capability negotiation order from gvplugin_install.
 *
 * @see lib/gvc/gvcext.h:gvrender_engine_s
 * @see lib/gvc/gvplugin.c:gvplugin_install
 */
export interface RendererPlugin {
  /** Format name, e.g. "svg", "dot:core". Type prefix (before `:`) is the sort key. */
  readonly type: string;
  /** Capability quality — higher wins when multiple plugins match the same format. */
  readonly quality: number;

  beginGraph(g: Graph, job: RenderJob): void;
  endGraph(g: Graph, job: RenderJob): void;
  beginNode(n: Node, job: RenderJob): void;
  endNode(n: Node, job: RenderJob): void;
  beginEdge(e: Edge, job: RenderJob): void;
  endEdge(e: Edge, job: RenderJob): void;
  textspan(pos: Point, span: TextSpan, job: RenderJob): void;
  ellipse(center: Point, rx: number, ry: number, filled: boolean, job: RenderJob): void;
  polygon(pts: Point[], filled: boolean, job: RenderJob): void;
  bezier(pts: Point[], filled: boolean, job: RenderJob): void;
  polyline(pts: Point[], job: RenderJob): void;
  comment?(text: string, job: RenderJob): void;
  beginAnchor?(href: string, tooltip: string, target: string, id: string, job: RenderJob): void;
  endAnchor?(job: RenderJob): void;
  beginLabel?(type: LabelType, job: RenderJob): void;
  endLabel?(job: RenderJob): void;
}

// ---------------------------------------------------------------------------
// LayoutEngine interface
// ---------------------------------------------------------------------------

/**
 * TypeScript equivalent of the layout-engine plugin vtable.
 *
 * @see lib/gvc/gvplugin.h:gvlayout_engine_s
 */
export interface LayoutEngine {
  /** Engine name, e.g. "dot", "neato". */
  readonly type: string;
  layout(g: Graph): void;
  cleanup(g: Graph): void;
}

// ---------------------------------------------------------------------------
// GvcContext
// ---------------------------------------------------------------------------

/** Find the insertion index for plugin in sorted renderers array. */
class PluginRegistry {
  /** @see lib/gvc/gvplugin.c:gvplugin_install — ordering rules */
  static insertionIdx(renderers: RendererPlugin[], plugin: RendererPlugin): number {
    const pPfx = plugin.type.split(':')[0];
    for (let i = 0; i < renderers.length; i++) {
      const e = renderers[i]!;
      const ePfx = e.type.split(':')[0];
      if (ePfx < pPfx) continue;
      if (ePfx > pPfx) return i;
      if (e.quality > plugin.quality) continue;
      return i;
    }
    return renderers.length;
  }
}

/**
 * Root Graphviz context.  Owns the plugin registry, text measurer, and
 * the layout-engine dispatch.
 *
 * Counterpart of GVC_t in lib/gvc/gvcint.h.
 *
 * @see lib/gvc/gvc.h:gvContext
 */
export class GvcContext {
  private readonly renderers: RendererPlugin[] = [];
  private readonly layouts: Map<string, LayoutEngine> = new Map();

  textMeasurer: TextMeasurer;
  readonly debug: DebugOptions | undefined;

  constructor(measurer: TextMeasurer, options?: { debug?: DebugOptions }) {
    this.textMeasurer = measurer;
    this.debug = options?.debug;
  }

  /** Register a renderer or layout engine; overload discriminated by `quality`. */
  register(p: RendererPlugin): void;
  register(p: LayoutEngine): void;
  register(p: RendererPlugin | LayoutEngine): void {
    if ('quality' in p) {
      const idx = PluginRegistry.insertionIdx(this.renderers, p);
      this.renderers.splice(idx, 0, p);
    } else {
      this.layouts.set(p.type, p);
    }
  }

  /**
   * Return the first registered renderer whose type prefix matches format.
   * Because renderers are sorted quality-descending within a prefix, the first
   * match is always the highest-quality one (last-registered wins on tie).
   *
   * @throws Error if no renderer is registered for format
   * @see lib/gvc/gvplugin.c:gvplugin_find
   */
  bestRenderer(format: string): RendererPlugin {
    for (const r of this.renderers) {
      if (r.type.split(':')[0] === format) return r;
    }
    throw new Error(`no renderer registered for format: ${format}`);
  }

  /**
   * Run layout on g using engineName, then call cleanup.
   *
   * @throws Error if the engine is not registered
   * @see lib/gvc/gvlayout.c:gvLayoutJobs
   */
  layout(g: Graph, engineName: string): void {
    const engine = this.layouts.get(engineName);
    if (engine === undefined) {
      throw new Error(`no layout engine registered: ${engineName}`);
    }
    engine.layout(g);
    engine.cleanup(g);
  }
}
