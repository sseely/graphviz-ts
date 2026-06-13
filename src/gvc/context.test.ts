// SPDX-License-Identifier: EPL-2.0

/**
 * Acceptance tests for GvcContext plugin capability negotiation (T25).
 *
 * AC1: bestRenderer returns highest-quality plugin for a format
 * AC2: equal-quality tie: last-registered wins
 * AC3: unknown format throws with format name in message
 * AC4: alpha ordering — "dot" entries precede "svg" entries in registry
 * AC5: layout() dispatches to the registered engine; throws if absent
 */

import { describe, it, expect } from 'vitest';
import { GvcContext } from './context.js';
import type { RendererPlugin, LayoutEngine } from './context.js';
import type { TextMeasurer } from '../common/textmeasure.js';
import type { Graph } from '../model/graph.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const stubMeasurer: TextMeasurer = { measure: () => ({ w: 0, h: 0 }) };

// Class-based stub avoids spread/cast patterns that confuse Lizard's TS parser.
class StubPlugin implements RendererPlugin {
  constructor(readonly type: string, readonly quality: number) {}
  beginGraph() {}
  endGraph() {}
  beginNode() {}
  endNode() {}
  beginEdge() {}
  endEdge() {}
  textspan() {}
  ellipse() {}
  polygon() {}
  bezier() {}
  polyline() {}
}

// Inline intersection types in function return annotations confuse Lizard.
type TestEngine = LayoutEngine & { calls: string[] };

function makeEngine(type: string): TestEngine {
  const calls: string[] = [];
  return {
    type,
    layout(_g: Graph) { calls.push('layout'); },
    cleanup(_g: Graph) { calls.push('cleanup'); },
    calls,
  };
}

// ---------------------------------------------------------------------------
// AC1: bestRenderer quality selection
// ---------------------------------------------------------------------------

describe('AC1: bestRenderer — quality wins', () => {
  it('returns higher-quality plugin when two svg plugins registered', () => {
    const ctx = new GvcContext(stubMeasurer);
    const low = new StubPlugin('svg', 5);
    const high = new StubPlugin('svg', 10);
    ctx.register(low);
    ctx.register(high);
    expect(ctx.bestRenderer('svg')).toBe(high);
  });
});

// ---------------------------------------------------------------------------
// AC2: last-registered wins on equal quality
// ---------------------------------------------------------------------------

describe('AC2: bestRenderer — last-registered wins on tie', () => {
  it('returns second plugin when both have equal quality', () => {
    const ctx = new GvcContext(stubMeasurer);
    const first = new StubPlugin('svg', 5);
    const second = new StubPlugin('svg', 5);
    ctx.register(first);
    ctx.register(second);
    expect(ctx.bestRenderer('svg')).toBe(second);
  });
});

// ---------------------------------------------------------------------------
// AC3: unknown format throws
// ---------------------------------------------------------------------------

describe('AC3: bestRenderer — unknown format throws', () => {
  it('throws an error with the format name in the message', () => {
    const ctx = new GvcContext(stubMeasurer);
    expect(() => ctx.bestRenderer('png')).toThrow('png');
  });
});

// ---------------------------------------------------------------------------
// AC4: alpha ordering
// ---------------------------------------------------------------------------

describe('AC4: registry alpha ordering', () => {
  it('finds dot and svg regardless of registration order', () => {
    const ctx = new GvcContext(stubMeasurer);
    const svg = new StubPlugin('svg', 0);
    const dot = new StubPlugin('dot', 0);
    ctx.register(svg);  // register svg first (reverse alpha order)
    ctx.register(dot);
    expect(ctx.bestRenderer('dot')).toBe(dot);
    expect(ctx.bestRenderer('svg')).toBe(svg);
  });
});

// ---------------------------------------------------------------------------
// AC5: layout engine dispatch
// ---------------------------------------------------------------------------

describe('AC5: layout() engine dispatch', () => {
  it('layout() runs layout only; freeLayout() runs cleanup (C: gvLayoutJobs/gvFreeLayout)', () => {
    const ctx = new GvcContext(stubMeasurer);
    const engine = makeEngine('dot');
    ctx.register(engine);
    const g = {} as unknown as Graph;
    ctx.layout(g, 'dot');
    expect(engine.calls).toEqual(['layout']);
    ctx.freeLayout(g, 'dot');
    expect(engine.calls).toEqual(['layout', 'cleanup']);
  });

  it('throws when engine is not registered', () => {
    const ctx = new GvcContext(stubMeasurer);
    const g = {} as unknown as Graph;
    expect(() => ctx.layout(g, 'neato')).toThrow('neato');
  });
});
