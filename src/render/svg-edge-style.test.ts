// SPDX-License-Identifier: EPL-2.0

/**
 * T4: Edge graphics — svgEdgePath and svgArrowPolygons read job.obj.
 *
 * Oracle: verified against dot -Tsvg 15.0.0
 * @see lib/common/emit.c:emit_edge_graphics (~2350-2440)
 * @see plugin/core/gvrender_core_svg.c:svg_bzptarray / svg_polygon
 */

import { describe, it, expect } from 'vitest';
import { svgEdgePath, svgArrowPolygons } from './svg-helpers.js';
import { RenderJob, createObjState, ObjType } from '../gvc/job.js';
import { PenType } from '../gvc/context.js';
import type { ObjState } from '../gvc/job.js';
import type { Point } from '../model/geom.js';
import type { TextMeasurer } from '../common/textmeasure.js';
import { Graph } from '../model/graph.js';
import { Node } from '../model/node.js';
import { Edge } from '../model/edge.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const measurer: TextMeasurer = { measure: () => ({ w: 0, h: 0 }) };

/** Build a job with devscale matching GVRENDER_Y_GOES_DOWN convention. */
function makeEdgeJob(): RenderJob {
  const j = new RenderJob('svg', measurer);
  j.bb = { ll: { x: 0, y: 0 }, ur: { x: 200, y: 200 } };
  j.zoom = 1;
  j.devscale = { x: 1, y: -1 };
  j.translation = { x: 0, y: 0 };
  j.rotation = 0;
  return j;
}

/** Build an edge obj-state with explicit pen color/type/width. */
function makeEdgeObj(penColorStr: string, pen: PenType, penWidth: number): ObjState {
  const obj = createObjState(ObjType.Edge);
  obj.penColor = { type: 'string', s: penColorStr };
  obj.pen = pen;
  obj.penWidth = penWidth;
  return obj;
}

/** Build a minimal Edge with one 4-point Bezier spline and optional arrow pts. */
function makeStyledEdge(headPts?: Point[], tailPts?: Point[]): Edge {
  const g = new Graph('G', 'directed');
  const e = new Edge(new Node(0, 'A', g), new Node(1, 'B', g), '');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- C-interop: spl is runtime-dynamic
  (e.info as any).spl = {
    size: 1,
    list: [{
      size: 4,
      list: [
        { x: 0, y: 0 }, { x: 10, y: 20 },
        { x: 30, y: 20 }, { x: 40, y: 0 },
      ],
    }],
  };
  if (headPts !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- C-interop: _arrowPts runtime-dynamic
    (e.info as any)._arrowPts = headPts;
  }
  if (tailPts !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- C-interop: _tailArrowPts runtime-dynamic
    (e.info as any)._tailArrowPts = tailPts;
  }
  return e;
}

const ARROW_PTS: Point[] = [
  { x: 40, y: 0 }, { x: 35, y: 5 }, { x: 45, y: 5 },
];

// ---------------------------------------------------------------------------
// Test bodies
// ---------------------------------------------------------------------------

/** AC-T4-A: unstyled edge — black path fill=none, black arrow polygon. */
function testEdgeUnstyled(): void {
  const job = makeEdgeJob();
  job.pushObj(makeEdgeObj('black', PenType.Solid, 1.0));
  const e = makeStyledEdge(ARROW_PTS);
  svgEdgePath(e, job);
  svgArrowPolygons(e, job);
  const out = job.output.join('');
  expect(out).toContain('fill="none"');
  expect(out).toContain('stroke="black"');
  expect(out).not.toContain('stroke-width=');
  expect(out).not.toContain('stroke-dasharray=');
  expect(out).toContain('<polygon fill="black" stroke="black"');
}

/** AC-T4-B: color=red — red path and red arrow polygon. */
function testEdgeColorRed(): void {
  const job = makeEdgeJob();
  job.pushObj(makeEdgeObj('red', PenType.Solid, 1.0));
  const e = makeStyledEdge(ARROW_PTS);
  svgEdgePath(e, job);
  svgArrowPolygons(e, job);
  const out = job.output.join('');
  expect(out).toContain('stroke="red"');
  expect(out).not.toContain('stroke-width=');
  expect(out).toContain('<polygon fill="red" stroke="red"');
}

/** AC-T4-C: penwidth=2 — stroke-width="2" on path. */
function testEdgePenwidth(): void {
  const job = makeEdgeJob();
  job.pushObj(makeEdgeObj('black', PenType.Solid, 2.0));
  const e = makeStyledEdge(ARROW_PTS);
  svgEdgePath(e, job);
  svgArrowPolygons(e, job);
  const out = job.output.join('');
  expect(out).toContain('stroke-width="2"');
  expect(out).not.toContain('stroke-dasharray=');
}

/** AC-T4-D: style=dashed — stroke-dasharray="5,2", no stroke-width. */
function testEdgeDashed(): void {
  const job = makeEdgeJob();
  job.pushObj(makeEdgeObj('black', PenType.Dashed, 1.0));
  const e = makeStyledEdge();
  svgEdgePath(e, job);
  const out = job.output.join('');
  expect(out).toContain('stroke-dasharray="5,2"');
  expect(out).not.toContain('stroke-width=');
}

/** AC-T4-E: style=dotted — stroke-dasharray="1,5". */
function testEdgeDotted(): void {
  const job = makeEdgeJob();
  job.pushObj(makeEdgeObj('black', PenType.Dotted, 1.0));
  const e = makeStyledEdge();
  svgEdgePath(e, job);
  const out = job.output.join('');
  expect(out).toContain('stroke-dasharray="1,5"');
}

/** AC-T4-F: bold (penWidth=2) → stroke-width="2" on path and arrow. */
function testEdgeBold(): void {
  const job = makeEdgeJob();
  job.pushObj(makeEdgeObj('black', PenType.Solid, 2.0));
  const e = makeStyledEdge(ARROW_PTS);
  svgEdgePath(e, job);
  svgArrowPolygons(e, job);
  const out = job.output.join('');
  expect(out).toContain('stroke-width="2"');
}

/** AC-T4-G: colored arrowhead uses pen color — not hardcoded black. */
function testEdgeColoredArrowhead(): void {
  const job = makeEdgeJob();
  job.pushObj(makeEdgeObj('blue', PenType.Solid, 1.0));
  const e = makeStyledEdge(ARROW_PTS);
  svgArrowPolygons(e, job);
  const out = job.output.join('');
  expect(out).toContain('<polygon fill="blue" stroke="blue"');
  expect(out).not.toContain('fill="black"');
}

/** AC-T4-H: attribute order fill→stroke→width→dasharray→d (byte-stability guard). */
function testEdgePathAttrOrder(): void {
  const job = makeEdgeJob();
  job.pushObj(makeEdgeObj('red', PenType.Dashed, 2.0));
  const e = makeStyledEdge();
  svgEdgePath(e, job);
  const out = job.output.join('');
  const fillPos = out.indexOf('fill="none"');
  const strokePos = out.indexOf('stroke="red"');
  const widthPos = out.indexOf('stroke-width=');
  const dashPos = out.indexOf('stroke-dasharray=');
  const dPos = out.indexOf(' d="');
  expect(fillPos).toBeGreaterThan(-1);
  expect(strokePos).toBeGreaterThan(fillPos);
  expect(widthPos).toBeGreaterThan(strokePos);
  expect(dashPos).toBeGreaterThan(widthPos);
  expect(dPos).toBeGreaterThan(dashPos);
}

// ---------------------------------------------------------------------------
// describe / it registrations
// ---------------------------------------------------------------------------

describe('T4: edge graphics read job.obj', () => {
  it('AC-T4-A: unstyled edge emits black path and black arrow', testEdgeUnstyled);
  it('AC-T4-B: color=red emits red path and red arrow', testEdgeColorRed);
  it('AC-T4-C: penwidth=2 emits stroke-width="2"', testEdgePenwidth);
  it('AC-T4-D: dashed emits stroke-dasharray="5,2" (no regression)', testEdgeDashed);
  it('AC-T4-E: dotted emits stroke-dasharray="1,5"', testEdgeDotted);
  it('AC-T4-F: bold resolves to penwidth 2 — stroke-width="2"', testEdgeBold);
  it('AC-T4-G: colored arrowhead uses pen color not hardcoded black', testEdgeColoredArrowhead);
  it('AC-T4-H: attribute order fill→stroke→width→dash→d', testEdgePathAttrOrder);
});
