// SPDX-License-Identifier: EPL-2.0

/**
 * Shared test stubs for map.test.ts and map-renderers.test.ts.
 * No describe/it calls — safe to import from any test file.
 */

import { RenderJob, ObjType, EmitState, MapShape } from '../gvc/job.js';
import type { ObjState } from '../gvc/job.js';
import { PenType, FillType } from '../gvc/context.js';
import { Graph } from '../model/graph.js';
import { Node } from '../model/node.js';
import type { TextMeasurer } from '../common/textmeasure.js';

const measurer: TextMeasurer = { measure: () => ({ w: 0, h: 0 }) };

export function makeJob(): RenderJob {
  const j = new RenderJob('plain', measurer);
  j.bb = { ll: { x: 0, y: 0 }, ur: { x: 144, y: 72 } };
  return j;
}

export function makeObjState(): ObjState {
  return {
    parent: null, type: ObjType.Node, graphObj: null,
    emitState: EmitState.NDraw,
    penColor: { type: 'string', s: 'black' },
    fillColor: { type: 'string', s: 'white' },
    stopColor: { type: 'none' },
    gradientAngle: 0, gradientFrac: 0,
    pen: PenType.Solid, fill: FillType.None, penWidth: 1.0,
    rawStyle: [],
    label: null, xlabel: null, tailLabel: null, headLabel: null,
    url: null, id: null, labelUrl: null, tailUrl: null, headUrl: null,
    tooltip: null, labelTooltip: null, tailTooltip: null, headTooltip: null,
    target: null, labelTarget: null, tailTarget: null, headTarget: null,
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

export function makeGraph(): Graph {
  const g = new Graph('G', 'directed');
  g.info.bb = { ll: { x: 0, y: 0 }, ur: { x: 144, y: 72 } };
  return g;
}

export function makeNode(g: Graph, name = 'A'): Node {
  const n = new Node(0, name, g);
  n.info.coord = { x: 72, y: 36 };
  n.info.width = 1.0;
  n.info.height = 0.5;
  g.nodes.set(name, n);
  return n;
}
