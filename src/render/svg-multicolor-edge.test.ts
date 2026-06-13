// SPDX-License-Identifier: EPL-2.0

/**
 * M1: Multi-color parallel-bezier edge tests.
 *
 * Oracle: `printf 'digraph{a->b[color="red:blue"]}' | dot -Tsvg`
 *   → two parallel paths (red x≈26, blue x≈28) + head arrow red.
 *
 * @see lib/common/emit.c:2442-2528 (else if numc branch)
 */

import { describe, it, expect } from 'vitest';
import { emitParallelEdgePaths, svgEdgePath } from './svg-helpers.js';
import { RenderJob, createObjState, ObjType } from '../gvc/job.js';
import { PenType } from '../gvc/context.js';
import type { ObjState } from '../gvc/job.js';
import type { TextMeasurer } from '../common/textmeasure.js';
import { Graph } from '../model/graph.js';
import { Node } from '../model/node.js';
import { Edge } from '../model/edge.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const measurer: TextMeasurer = { measure: () => ({ w: 0, h: 0 }) };

function makeJob(): RenderJob {
  const j = new RenderJob('svg', measurer);
  j.bb = { ll: { x: 0, y: 0 }, ur: { x: 200, y: 200 } };
  j.zoom = 1;
  j.devscale = { x: 1, y: -1 };
  j.translation = { x: 0, y: 0 };
  j.rotation = 0;
  return j;
}

function makeEdgeObj(penColorStr: string): ObjState {
  const obj = createObjState(ObjType.Edge);
  obj.penColor = { type: 'string', s: penColorStr };
  obj.pen = PenType.Solid;
  obj.penWidth = 1.0;
  return obj;
}

/**
 * Build a minimal edge with a straight vertical spline in graphviz y-up space.
 * devscale.y=-1 means the y-coordinates are negated in SVG output.
 */
function makeEdgeWithSpline(colorAttr: string): Edge {
  const g = new Graph('G', 'directed');
  const e = new Edge(new Node(0, 'a', g), new Node(1, 'b', g), '');
  e.attrs.set('color', colorAttr);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (e.info as any).spl = {
    size: 1,
    list: [{
      size: 4,
      list: [
        { x: 26, y: 71.7 },
        { x: 26, y: 64.41 },
        { x: 26, y: 55.73 },
        { x: 26, y: 47.54 },
      ],
      sflag: 0,
      eflag: 0,
      sp: { x: 26, y: 47.54 },
      ep: { x: 26, y: 47.54 },
    }],
  };
  return e;
}

// ---------------------------------------------------------------------------
// AC-M1-A: two-color edge → two parallel paths
// ---------------------------------------------------------------------------

describe('M1: emitParallelEdgePaths — 2-color edge', () => {
  it('AC-M1-A1: emits exactly 2 <path> elements for color="red:blue"', () => {
    const job = makeJob();
    job.pushObj(makeEdgeObj('red'));
    const e = makeEdgeWithSpline('red:blue');
    emitParallelEdgePaths(e, job, 'red:blue');
    const out = job.output.join('');
    const matches = out.match(/<path /g);
    expect(matches).toHaveLength(2);
  });

  it('AC-M1-A2: first path stroke=red, second path stroke=blue', () => {
    const job = makeJob();
    job.pushObj(makeEdgeObj('red'));
    const e = makeEdgeWithSpline('red:blue');
    emitParallelEdgePaths(e, job, 'red:blue');
    const out = job.output.join('');
    const redIdx = out.indexOf('stroke="red"');
    const blueIdx = out.indexOf('stroke="blue"');
    expect(redIdx).toBeGreaterThan(-1);
    expect(blueIdx).toBeGreaterThan(-1);
    expect(redIdx).toBeLessThan(blueIdx); // red first
  });

  it('AC-M1-A3: all paths have fill="none"', () => {
    const job = makeJob();
    job.pushObj(makeEdgeObj('red'));
    const e = makeEdgeWithSpline('red:blue');
    emitParallelEdgePaths(e, job, 'red:blue');
    const out = job.output.join('');
    const paths = out.match(/<path fill="none"/g);
    expect(paths).toHaveLength(2);
  });

  it('AC-M1-A4: returns headColor=red, tailColor=blue for 2-color', () => {
    const job = makeJob();
    job.pushObj(makeEdgeObj('red'));
    const e = makeEdgeWithSpline('red:blue');
    const result = emitParallelEdgePaths(e, job, 'red:blue');
    expect(result.headColor).toBe('red');
    expect(result.tailColor).toBe('blue');
  });

  it('AC-M1-A5: second path x-coordinates offset from first by ~SEP=2', () => {
    const job = makeJob();
    job.pushObj(makeEdgeObj('red'));
    const e = makeEdgeWithSpline('red:blue');
    emitParallelEdgePaths(e, job, 'red:blue');
    const out = job.output.join('');
    // Extract x from M-command in each path d="..."
    const pathDs = [...out.matchAll(/ d="M([0-9.-]+),/g)];
    expect(pathDs).toHaveLength(2);
    const x1 = parseFloat(pathDs[0]![1]!);
    const x2 = parseFloat(pathDs[1]![1]!);
    expect(Math.abs(Math.abs(x2 - x1) - 2)).toBeLessThan(0.1);
  });
});

// ---------------------------------------------------------------------------
// AC-M1-B: three-color edge → three parallel paths
// ---------------------------------------------------------------------------

describe('M1: emitParallelEdgePaths — 3-color edge', () => {
  it('AC-M1-B1: emits exactly 3 <path> elements for color="red:green:blue"', () => {
    const job = makeJob();
    job.pushObj(makeEdgeObj('red'));
    const e = makeEdgeWithSpline('red:green:blue');
    emitParallelEdgePaths(e, job, 'red:green:blue');
    const out = job.output.join('');
    const matches = out.match(/<path /g);
    expect(matches).toHaveLength(3);
  });

  it('AC-M1-B2: paths in order red, green, blue', () => {
    const job = makeJob();
    job.pushObj(makeEdgeObj('red'));
    const e = makeEdgeWithSpline('red:green:blue');
    emitParallelEdgePaths(e, job, 'red:green:blue');
    const out = job.output.join('');
    const redIdx = out.indexOf('stroke="red"');
    const greenIdx = out.indexOf('stroke="green"');
    const blueIdx = out.indexOf('stroke="blue"');
    expect(redIdx).toBeLessThan(greenIdx);
    expect(greenIdx).toBeLessThan(blueIdx);
  });

  it('AC-M1-B3: headColor=red, tailColor=green for 3-color', () => {
    const job = makeJob();
    job.pushObj(makeEdgeObj('red'));
    const e = makeEdgeWithSpline('red:green:blue');
    const result = emitParallelEdgePaths(e, job, 'red:green:blue');
    expect(result.headColor).toBe('red');
    expect(result.tailColor).toBe('green');
  });
});

// ---------------------------------------------------------------------------
// AC-M1-C: single-color edge → single path (unchanged T4 path)
// ---------------------------------------------------------------------------

describe('M1: single-color edge (no numc) — unchanged T4 path', () => {
  it('single-color emits exactly 1 <path> via svgEdgePath', () => {
    const job = makeJob();
    job.pushObj(makeEdgeObj('red'));
    const e = makeEdgeWithSpline('red');
    svgEdgePath(e, job);
    const out = job.output.join('');
    const matches = out.match(/<path /g);
    expect(matches).toHaveLength(1);
    expect(out).toContain('stroke="red"');
  });
});

// ---------------------------------------------------------------------------
// AC-M1-D: empty color token → DEFAULT_COLOR (black)
// ---------------------------------------------------------------------------

describe('M1: empty color token → black', () => {
  it('empty leading color in ":blue" is treated as black', () => {
    const job = makeJob();
    job.pushObj(makeEdgeObj('black'));
    const e = makeEdgeWithSpline(':blue');
    emitParallelEdgePaths(e, job, ':blue');
    const out = job.output.join('');
    expect(out).toContain('stroke="black"');
    expect(out).toContain('stroke="blue"');
  });
});
