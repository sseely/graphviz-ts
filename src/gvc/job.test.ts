// SPDX-License-Identifier: EPL-2.0

/**
 * Tests for RenderJob.
 *
 * AC1: printDouble matches gvprintdouble from lib/gvc/gvdevice.c
 * AC2: write accumulates strings in output[]
 * AC3: pushObj / popObj stack behaves correctly
 * AC4: popObj on empty stack throws
 */

import { describe, it, expect } from 'vitest';
import { RenderJob, ObjType, EmitState, MapShape } from './job.js';
import type { ObjState } from './job.js';
import type { TextMeasurer } from '../common/textmeasure.js';
import { PenType, FillType } from './context.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const stubMeasurer: TextMeasurer = { measure: () => ({ w: 0, h: 0 }) };

function makeJob(): RenderJob {
  return new RenderJob('svg', stubMeasurer);
}

const STATE_FLAGS: Pick<
  ObjState,
  | 'explicitTooltip' | 'explicitTailTooltip' | 'explicitHeadTooltip'
  | 'explicitLabelTooltip' | 'explicitTailTarget' | 'explicitHeadTarget'
  | 'explicitEdgeTarget' | 'explicitTailUrl' | 'explicitHeadUrl'
  | 'labelEdgeAligned'
> = {
  explicitTooltip: false, explicitTailTooltip: false,
  explicitHeadTooltip: false, explicitLabelTooltip: false,
  explicitTailTarget: false, explicitHeadTarget: false,
  explicitEdgeTarget: false, explicitTailUrl: false,
  explicitHeadUrl: false, labelEdgeAligned: false,
};

const STATE_URLS: Pick<
  ObjState,
  | 'url' | 'id' | 'labelUrl' | 'tailUrl' | 'headUrl'
  | 'tooltip' | 'labelTooltip' | 'tailTooltip' | 'headTooltip'
  | 'target' | 'labelTarget' | 'tailTarget' | 'headTarget'
> = {
  url: null, id: null, labelUrl: null, tailUrl: null, headUrl: null,
  tooltip: null, labelTooltip: null, tailTooltip: null, headTooltip: null,
  target: null, labelTarget: null, tailTarget: null, headTarget: null,
};

const STATE_MAPS: Pick<
  ObjState,
  'urlMapShape' | 'urlMapPts' | 'urlBsplineMapPts' | 'tailEndMapPts' | 'headEndMapPts'
> = {
  urlMapShape: MapShape.Rectangle,
  urlMapPts: [], urlBsplineMapPts: [],
  tailEndMapPts: [], headEndMapPts: [],
};

function makeState(label: string): ObjState {
  return {
    parent: null, type: ObjType.Node, graphObj: null,
    emitState: EmitState.NDraw,
    penColor: { type: 'none' }, fillColor: { type: 'none' },
    stopColor: { type: 'none' },
    gradientAngle: 0, gradientFrac: 0,
    pen: PenType.Solid, fill: FillType.None, penWidth: 1,
    rawStyle: [],
    label, xlabel: null, tailLabel: null, headLabel: null,
    ...STATE_URLS,
    ...STATE_FLAGS,
    ...STATE_MAPS,
  };
}

// ---------------------------------------------------------------------------
// AC1: printDouble
// ---------------------------------------------------------------------------

describe('RenderJob.printDouble', () => {
  it.each([
    [0,        '0'],
    [-0,       '0'],
    [-0.001,   '0'],
    [0.003,    '0'],
    [0.5,      '0.5'],
    [1.0,      '1'],
    [1.5,      '1.5'],
    [100,      '100'],
    [1.23456,  '1.23'],
  ])('printDouble(%f) => %s', (input, expected) => {
    const job = makeJob();
    job.printDouble(input);
    expect(job.output.join('')).toBe(expected);
  });
});

// Exact binary ties at 2 dp (fractional part odd/8) round half-to-
// even like C snprintf("%.2f"), not half-up like Number.toFixed.
// @see lib/gvc/gvdevice.c:gvprintdouble
describe('RenderJob.printDouble tie rounding', () => {
  it.each([
    [34.125,   '34.12'],
    [-34.125,  '-34.12'],
    [45.375,   '45.38'],
    [0.625,    '0.62'],
    [0.875,    '0.88'],
    [-0.375,   '-0.38'],
    [2.5,      '2.5'],
    [0.195,    '0.2'],
  ])('printDouble(%f) rounds ties half-to-even => %s', (input, expected) => {
    const job = makeJob();
    job.printDouble(input);
    expect(job.output.join('')).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// AC2: write accumulation
// ---------------------------------------------------------------------------

describe('RenderJob.write', () => {
  it('accumulates strings into output[]', () => {
    const job = makeJob();
    job.write('foo');
    job.write('bar');
    expect(job.output.join('')).toBe('foobar');
  });
});

// ---------------------------------------------------------------------------
// AC3: pushObj / popObj stack
// ---------------------------------------------------------------------------

describe('RenderJob obj stack', () => {
  it('obj is null when stack is empty', () => {
    const job = makeJob();
    expect(job.obj).toBeNull();
  });

  it('obj returns top of stack after pushes and pops', () => {
    const job = makeJob();
    const state1 = makeState('s1');
    const state2 = makeState('s2');

    job.pushObj(state1);
    job.pushObj(state2);
    expect(job.obj).toBe(state2);

    job.popObj();
    expect(job.obj).toBe(state1);

    job.popObj();
    expect(job.obj).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC4: popObj on empty stack throws
// ---------------------------------------------------------------------------

describe('RenderJob.popObj', () => {
  it('throws when stack is empty', () => {
    const job = makeJob();
    expect(() => job.popObj()).toThrow();
  });
});
