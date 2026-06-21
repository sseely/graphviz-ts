// SPDX-License-Identifier: EPL-2.0

/**
 * RenderJob — full implementation, replacing the T25 scaffold.
 *
 * Ports GVJ_s and obj_state_s from lib/gvc/gvcjob.h.
 *
 * @see lib/gvc/gvcjob.h:GVJ_s
 * @see lib/gvc/gvcjob.h:obj_state_s
 * @see lib/gvc/gvdevice.c:gvprintdouble
 */

import type { Graph } from '../model/graph.js';
import type { Node } from '../model/node.js';
import type { Edge } from '../model/edge.js';
import type { Point, Box } from '../model/geom.js';
import type { GVColor } from '../common/color.js';
import type { TextMeasurer } from '../common/textmeasure.js';
import type { RendererPlugin } from './context.js';
import { PenType, FillType } from './context.js';

// ---------------------------------------------------------------------------
// Enums — values must match C exactly
// ---------------------------------------------------------------------------

/** @see lib/gvc/gvcjob.h:obj_type */
export const enum ObjType {
  RootGraph = 0,
  Cluster    = 1,
  Node       = 2,
  Edge       = 3,
}

/** @see lib/gvc/gvcjob.h:emit_state_t */
export const enum EmitState {
  GDraw  = 0,
  CDraw  = 1,
  TDraw  = 2,
  HDraw  = 3,
  GLabel = 4,
  CLabel = 5,
  TLabel = 6,
  HLabel = 7,
  NDraw  = 8,
  EDraw  = 9,
  NLabel = 10,
  ELabel = 11,
}

/** @see lib/gvc/gvcjob.h:map_shape_t */
export const enum MapShape {
  Rectangle = 0,
  Circle    = 1,
  Polygon   = 2,
}

// ---------------------------------------------------------------------------
// Flag bit constants — @see lib/gvc/gvcjob.h
// ---------------------------------------------------------------------------

export const EMIT_SORTED             = 1 << 0;
export const EMIT_COLORS             = 1 << 1;
export const EMIT_CLUSTERS_LAST      = 1 << 2;
export const EMIT_PREORDER           = 1 << 3;
export const EMIT_EDGE_SORTED        = 1 << 4;
export const GVDEVICE_DOES_PAGES     = 1 << 5;
export const GVDEVICE_DOES_LAYERS    = 1 << 6;
export const GVDEVICE_EVENTS         = 1 << 7;
export const GVDEVICE_DOES_TRUECOLOR = 1 << 8;
export const GVDEVICE_BINARY_FORMAT  = 1 << 9;
export const GVDEVICE_COMPRESSED_FORMAT = 1 << 10;
export const GVDEVICE_NO_WRITER      = 1 << 11;
export const GVRENDER_Y_GOES_DOWN    = 1 << 12;
export const GVRENDER_DOES_TRANSFORM = 1 << 13;
export const GVRENDER_DOES_LABELS    = 1 << 15;
export const GVRENDER_DOES_MAPS      = 1 << 16;
export const GVRENDER_DOES_MAP_RECTANGLE = 1 << 17;
export const GVRENDER_DOES_MAP_CIRCLE    = 1 << 18;
export const GVRENDER_DOES_MAP_POLYGON   = 1 << 19;
export const GVRENDER_DOES_MAP_ELLIPSE   = 1 << 20;
export const GVRENDER_DOES_MAP_BSPLINE   = 1 << 21;
export const GVRENDER_DOES_TOOLTIPS      = 1 << 22;
export const GVRENDER_DOES_TARGETS       = 1 << 23;
export const GVRENDER_DOES_Z             = 1 << 24;
export const GVRENDER_NO_WHITE_BG        = 1 << 25;
export const LAYOUT_NOT_REQUIRED         = 1 << 26;
export const OUTPUT_NOT_REQUIRED         = 1 << 27;

// ---------------------------------------------------------------------------
// ObjState — @see lib/gvc/gvcjob.h:obj_state_s
// ---------------------------------------------------------------------------

/** TypeScript equivalent of obj_state_t. @see lib/gvc/gvcjob.h:obj_state_s */
export interface ObjState {
  parent: ObjState | null;
  type: ObjType;
  graphObj: Graph | Node | Edge | null;
  emitState: EmitState;
  penColor: GVColor;
  fillColor: GVColor;
  stopColor: GVColor;
  gradientAngle: number;
  gradientFrac: number;
  pen: PenType;
  fill: FillType;
  penWidth: number;
  rawStyle: string[];
  label: string | null;
  xlabel: string | null;
  tailLabel: string | null;
  headLabel: string | null;
  url: string | null;
  id: string | null;
  labelUrl: string | null;
  tailUrl: string | null;
  headUrl: string | null;
  tooltip: string | null;
  labelTooltip: string | null;
  tailTooltip: string | null;
  headTooltip: string | null;
  target: string | null;
  labelTarget: string | null;
  tailTarget: string | null;
  headTarget: string | null;
  explicitTooltip: boolean;
  explicitTailTooltip: boolean;
  explicitHeadTooltip: boolean;
  explicitLabelTooltip: boolean;
  explicitTailTarget: boolean;
  explicitHeadTarget: boolean;
  explicitEdgeTarget: boolean;
  explicitTailUrl: boolean;
  explicitHeadUrl: boolean;
  labelEdgeAligned: boolean;
  urlMapShape: MapShape;
  urlMapPts: Point[];
  urlBsplineMapPts: Point[][];
  tailEndMapPts: Point[];
  headEndMapPts: Point[];
}

// ---------------------------------------------------------------------------
// createObjState — @see lib/common/emit.c:push_obj_state
// ---------------------------------------------------------------------------

/** Default paint fields for a new obj-state. @see lib/common/emit.c:push_obj_state */
function defaultObjPaint(): Pick<ObjState,
  | 'penColor' | 'fillColor' | 'stopColor'
  | 'gradientAngle' | 'gradientFrac'
  | 'pen' | 'fill' | 'penWidth' | 'rawStyle'
> {
  return {
    penColor: { type: 'string', s: 'black' },
    fillColor: { type: 'string', s: 'white' },
    stopColor: { type: 'none' },
    gradientAngle: 0, gradientFrac: 0,
    pen: PenType.Solid, fill: FillType.None, penWidth: 1.0,
    rawStyle: [],
  };
}

/** Default URL/label string fields for a new obj-state. Null everywhere. */
function defaultObjStrings(): Pick<ObjState,
  | 'label' | 'xlabel' | 'tailLabel' | 'headLabel'
  | 'url' | 'id' | 'labelUrl' | 'tailUrl' | 'headUrl'
  | 'tooltip' | 'labelTooltip' | 'tailTooltip' | 'headTooltip'
  | 'target' | 'labelTarget' | 'tailTarget' | 'headTarget'
> {
  return {
    label: null, xlabel: null, tailLabel: null, headLabel: null,
    url: null, id: null, labelUrl: null, tailUrl: null, headUrl: null,
    tooltip: null, labelTooltip: null, tailTooltip: null, headTooltip: null,
    target: null, labelTarget: null, tailTarget: null, headTarget: null,
  };
}

/** Default explicit-flag and map fields for a new obj-state. All false/empty. */
function defaultObjFlags(): Pick<ObjState,
  | 'explicitTooltip' | 'explicitTailTooltip' | 'explicitHeadTooltip'
  | 'explicitLabelTooltip' | 'explicitTailTarget' | 'explicitHeadTarget'
  | 'explicitEdgeTarget' | 'explicitTailUrl' | 'explicitHeadUrl'
  | 'labelEdgeAligned'
  | 'urlMapShape' | 'urlMapPts' | 'urlBsplineMapPts'
  | 'tailEndMapPts' | 'headEndMapPts'
> {
  return {
    explicitTooltip: false, explicitTailTooltip: false,
    explicitHeadTooltip: false, explicitLabelTooltip: false,
    explicitTailTarget: false, explicitHeadTarget: false,
    explicitEdgeTarget: false, explicitTailUrl: false,
    explicitHeadUrl: false, labelEdgeAligned: false,
    urlMapShape: MapShape.Rectangle,
    urlMapPts: [], urlBsplineMapPts: [],
    tailEndMapPts: [], headEndMapPts: [],
  };
}

/**
 * Allocate a fresh default ObjState matching C's push_obj_state (no parent).
 * pen=SOLID, fill=NONE, penWidth=1.0; penColor black, fillColor white so
 * emitStyle emits "fill=none stroke=black" for unstyled objects (byte-stable).
 * Batch-2 callers overwrite type/graphObj/emitState per object.
 *
 * NOTE: fresh object per call; do NOT pool prematurely — profile first.
 * @see lib/common/emit.c:push_obj_state
 */
export function createObjState(type: ObjType = ObjType.Node): ObjState {
  return {
    parent: null, type, graphObj: null, emitState: EmitState.NDraw,
    ...defaultObjPaint(),
    ...defaultObjStrings(),
    ...defaultObjFlags(),
  };
}

// ---------------------------------------------------------------------------
// printDouble helpers — @see lib/gvc/gvdevice.c:gv_trim_zeros
// ---------------------------------------------------------------------------

/**
 * Format to 2 decimal places, rounding exact ties half-to-even as C's
 * snprintf("%.2f") does under FE_TONEAREST; Number.toFixed rounds them
 * half-away-from-zero instead. A tie at 2 dp exists iff the exact
 * decimal expansion terminates with '5' in the third place (fractional
 * part odd/8); its kept digit is then always 2 or 7, so bumping the
 * odd case never carries.
 *
 * @see lib/gvc/gvdevice.c:gvprintdouble
 */
function toFixed2HalfEven(n: number): string {
  // Exact tie at 2 dp ⇔ fractional part is odd/8. n*8 and n*4 are
  // exact (power-of-two scaling only shifts the exponent), so this
  // never misclassifies near-ties like 0.195 (= 0.19500…00624).
  if (!Number.isInteger(n * 8) || Number.isInteger(n * 4)) {
    return n.toFixed(2);
  }
  const s3 = n.toFixed(3); // exact expansion "x.yz5"
  const trunc = s3.slice(0, -1);
  const kept = trunc.charCodeAt(trunc.length - 1) - 48;
  // kept is always 2 or 7 for odd/8 ties; bumping 7 never carries.
  return kept % 2 === 0 ? trunc : trunc.slice(0, -1) + String(kept + 1);
}

/**
 * Mirrors gv_trim_zeros: given a "%.02f" result, return the trimmed string.
 * Assumes input has exactly 2 decimal places.
 *
 * @see lib/gvc/gvdevice.c:gv_trim_zeros
 */
function trimZeros(buf: string): string {
  const dotIdx = buf.indexOf('.');
  if (dotIdx < 0) {
    return buf;
  }
  // buf has exactly 2 decimal digits after the dot (from %.02f)
  const d1 = buf[dotIdx + 1];
  const d2 = buf[dotIdx + 2];
  if (d2 === '0') {
    if (d1 === '0') {
      return buf.slice(0, dotIdx);
    }
    return buf.slice(0, dotIdx + 2);
  }
  return buf;
}

// ---------------------------------------------------------------------------
// RenderJob — @see lib/gvc/gvcjob.h:GVJ_s
// ---------------------------------------------------------------------------

/**
 * Render job context.
 *
 * Ports GVJ_s from lib/gvc/gvcjob.h, adapted for the TypeScript
 * string-accumulator output model (no FILE* / output_data).
 *
 * @see lib/gvc/gvcjob.h:GVJ_s
 */
export class RenderJob {
  readonly output: string[] = [];
  readonly measurer: TextMeasurer;
  readonly format: string;

  bb: Box = { ll: { x: 0, y: 0 }, ur: { x: 0, y: 0 } };
  pad: Point = { x: 0, y: 0 };
  zoom: number = 1.0;
  dpi: Point = { x: 96, y: 96 };
  rotation: number = 0;
  scale: Point = { x: 1, y: 1 };
  translation: Point = { x: 0, y: 0 };
  devscale: Point = { x: 1, y: 1 };
  flags: number = 0;
  numLayers: number = 1;
  layerNum: number = 1;
  /** Layer names indexed 1..numLayers (set when rendering a layered graph). */
  layerIDs: (string | null)[] = [];
  nodeId: number = 0;
  edgeId: number = 0;
  clusterId: number = 0;
  /** Monotonic counter for linear gradient ids per render.
   * @see AD1; plugin/core/gvrender_core_svg.c:572 (static gradId) */
  linearGradId: number = 0;
  /** Monotonic counter for radial gradient ids per render.
   * @see AD1; plugin/core/gvrender_core_svg.c:608 (static rgradId) */
  radialGradId: number = 0;
  /** Whether the graph being rendered is directed (edge titles use -> vs --). */
  directed: boolean = true;
  /** Root graph's `id` attribute (GD_drawing(root)->id), '' if unset. Used as
   * the `<gid>_` prefix for non-root object ids. @see lib/common/emit.c:getObjId */
  drawingId: string = '';

  /**
   * Resolve an object's SVG id like C's getObjId (steps after layerPagePrefix):
   * a non-empty DOT `id` attr wins verbatim; otherwise non-root objects are
   * prefixed with `<drawingId>_` when the root graph has an id.
   * @see lib/common/emit.c:getObjId:209
   */
  objId(idAttr: string | undefined, defaultId: string, isRoot = false): string {
    if (idAttr !== undefined && idAttr.length > 0) return idAttr;
    if (!isRoot && this.drawingId.length > 0) return this.drawingId + '_' + defaultId;
    return defaultId;
  }

  /** Active renderer plugin; set by render() before walkNodes. */
  renderer?: RendererPlugin;

  private readonly objStack: ObjState[] = [];

  constructor(format: string, measurer: TextMeasurer) {
    this.format = format;
    this.measurer = measurer;
  }

  /** Layer id prefix for layers after the first (C layerPagePrefix).
   * @see lib/common/emit.c:197 */
  idLayerPrefix(): string {
    return this.layerNum > 1 ? this.layerIDs[this.layerNum] + '_' : '';
  }

  /** Layer id suffix appended to node/edge group ids (svg_begin_node idx).
   * @see plugin/core/gvrender_core_svg.c svg_begin_node/edge */
  idLayerSuffix(): string {
    return this.layerNum > 1 ? '_' + this.layerIDs[this.layerNum] : '';
  }

  /** Top of the object-state stack, or null if empty. */
  get obj(): ObjState | null {
    const len = this.objStack.length;
    return len > 0 ? (this.objStack[len - 1] ?? null) : null;
  }

  /** Push an object state onto the stack. */
  pushObj(state: ObjState): void {
    this.objStack.push(state);
  }

  /**
   * Pop the top object state from the stack.
   * @throws Error if the stack is empty.
   */
  popObj(): void {
    if (this.objStack.length === 0) {
      throw new Error('RenderJob.popObj: stack is empty');
    }
    this.objStack.pop();
  }

  /** Append a string to the output buffer. */
  write(s: string): void {
    this.output.push(s);
  }

  /**
   * Format a number and write it.
   * Replicates gvprintdouble from lib/gvc/gvdevice.c exactly:
   *   - Values in (-0.005, 0.005) emit "0" (suppresses -0).
   *   - Otherwise: format to 2 dp, strip trailing zeros / decimal point.
   *
   * @see lib/gvc/gvdevice.c:gvprintdouble
   */
  printDouble(n: number): void {
    if (n > -0.005 && n < 0.005) {
      this.output.push('0');
      return;
    }
    const buf = toFixed2HalfEven(n);
    this.output.push(trimZeros(buf));
  }

  /**
   * Write a point as two space-separated numbers.
   *
   * @see lib/gvc/gvdevice.c:gvprintpointf
   */
  printPoint(p: Point): void {
    this.printDouble(p.x);
    this.output.push(' ');
    this.printDouble(p.y);
  }
}
