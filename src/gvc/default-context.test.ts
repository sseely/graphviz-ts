// SPDX-License-Identifier: EPL-2.0

/**
 * Tests for createDefaultContext().
 *
 * AC1: bestRenderer returns a renderer for every built-in format without
 *      throwing.
 * AC2: bestRenderer returns a renderer whose type prefix matches the format.
 * AC3: Every built-in engine name is registered (ctx.layout does not throw
 *      "no layout engine registered" for any of the 8 engines).
 * AC4: An unknown format throws from bestRenderer.
 * AC5: An unknown engine throws from layout.
 */

import { describe, it, expect } from 'vitest';
import type { Graph } from '../model/graph.js';
import { createDefaultContext } from './default-context.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Stub graph satisfying the shape that GvcContext.layout() expects. */
const STUB_GRAPH = { info: undefined } as unknown as Graph;

const NOT_REGISTERED = 'no layout engine registered';

/** Assert an engine is registered: layout() must not throw the missing-engine message. */
function assertEngineRegistered(engine: string): void {
  const ctx = createDefaultContext();
  try {
    ctx.layout(STUB_GRAPH, engine);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    expect(msg).not.toContain(NOT_REGISTERED);
  }
}

/** Assert a renderer format is registered: bestRenderer() must not throw. */
function assertRendererRegistered(format: string): void {
  const ctx = createDefaultContext();
  const r = ctx.bestRenderer(format);
  expect(r).toBeDefined();
  expect(r.type.split(':')[0]).toBe(format);
}

// ---------------------------------------------------------------------------
// AC1 + AC2: renderer registration — all 11 built-in formats
// ---------------------------------------------------------------------------

describe('AC1+AC2: svg renderer registered', () => {
  it('bestRenderer("svg") returns a renderer with type prefix "svg"', () => {
    assertRendererRegistered('svg');
  });
});

describe('AC1+AC2: dot renderer registered', () => {
  it('bestRenderer("dot") returns a renderer with type prefix "dot"', () => {
    assertRendererRegistered('dot');
  });
});

describe('AC1+AC2: xdot renderer registered', () => {
  it('bestRenderer("xdot") returns a renderer with type prefix "xdot"', () => {
    assertRendererRegistered('xdot');
  });
});

describe('AC1+AC2: json0 renderer registered', () => {
  it('bestRenderer("json0") returns a renderer with type prefix "json0"', () => {
    assertRendererRegistered('json0');
  });
});

describe('AC1+AC2: json renderer registered', () => {
  it('bestRenderer("json") returns a renderer with type prefix "json"', () => {
    assertRendererRegistered('json');
  });
});

describe('AC1+AC2: plain renderer registered', () => {
  it('bestRenderer("plain") returns a renderer with type prefix "plain"', () => {
    assertRendererRegistered('plain');
  });
});

describe('AC1+AC2: plain-ext renderer registered', () => {
  it('bestRenderer("plain-ext") returns a renderer with type prefix "plain-ext"', () => {
    assertRendererRegistered('plain-ext');
  });
});

describe('AC1+AC2: imap renderer registered', () => {
  it('bestRenderer("imap") returns a renderer with type prefix "imap"', () => {
    assertRendererRegistered('imap');
  });
});

describe('AC1+AC2: imap-np renderer registered', () => {
  it('bestRenderer("imap-np") returns a renderer with type prefix "imap-np"', () => {
    assertRendererRegistered('imap-np');
  });
});

describe('AC1+AC2: cmapx renderer registered', () => {
  it('bestRenderer("cmapx") returns a renderer with type prefix "cmapx"', () => {
    assertRendererRegistered('cmapx');
  });
});

describe('AC1+AC2: cmapx-np renderer registered', () => {
  it('bestRenderer("cmapx-np") returns a renderer with type prefix "cmapx-np"', () => {
    assertRendererRegistered('cmapx-np');
  });
});

// ---------------------------------------------------------------------------
// AC3: engine registration — all 8 built-in engines
// ---------------------------------------------------------------------------

describe('AC3: dot engine registered', () => {
  it('ctx.layout does not throw "no layout engine registered" for "dot"', () => {
    assertEngineRegistered('dot');
  });
});

describe('AC3: neato engine registered', () => {
  it('ctx.layout does not throw "no layout engine registered" for "neato"', () => {
    assertEngineRegistered('neato');
  });
});

describe('AC3: fdp engine registered', () => {
  it('ctx.layout does not throw "no layout engine registered" for "fdp"', () => {
    assertEngineRegistered('fdp');
  });
});

describe('AC3: sfdp engine registered', () => {
  it('ctx.layout does not throw "no layout engine registered" for "sfdp"', () => {
    assertEngineRegistered('sfdp');
  });
});

describe('AC3: circo engine registered', () => {
  it('ctx.layout does not throw "no layout engine registered" for "circo"', () => {
    assertEngineRegistered('circo');
  });
});

describe('AC3: twopi engine registered', () => {
  it('ctx.layout does not throw "no layout engine registered" for "twopi"', () => {
    assertEngineRegistered('twopi');
  });
});

describe('AC3: osage engine registered', () => {
  it('ctx.layout does not throw "no layout engine registered" for "osage"', () => {
    assertEngineRegistered('osage');
  });
});

describe('AC3: patchwork engine registered', () => {
  it('ctx.layout does not throw "no layout engine registered" for "patchwork"', () => {
    assertEngineRegistered('patchwork');
  });
});

// ---------------------------------------------------------------------------
// AC4: unknown format throws from bestRenderer
// ---------------------------------------------------------------------------

describe('AC4: unknown renderer format throws', () => {
  it('bestRenderer("png") throws with "png" in the message', () => {
    const ctx = createDefaultContext();
    expect(() => ctx.bestRenderer('png')).toThrow('png');
  });
});

// ---------------------------------------------------------------------------
// AC5: unknown engine throws from layout
// ---------------------------------------------------------------------------

describe('AC5: unknown engine throws from layout', () => {
  it('ctx.layout("nonexistent-engine") throws with name in the message', () => {
    const ctx = createDefaultContext();
    expect(() => ctx.layout(STUB_GRAPH, 'nonexistent-engine')).toThrow(
      'nonexistent-engine',
    );
  });
});
