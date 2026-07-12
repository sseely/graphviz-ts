// SPDX-License-Identifier: EPL-2.0

import { describe, it, expect } from 'vitest';
import {
  stoj,
  ind,
  buildJson,
  Json0Renderer,
  JsonRenderer,
  createJson0Renderer,
  createJsonRenderer,
} from './json.js';
import { RenderJob } from '../gvc/job.js';
import { Graph } from '../model/graph.js';
import { Node } from '../model/node.js';
import { Edge } from '../model/edge.js';
import type { TextMeasurer } from '../common/textmeasure.js';

// ---------------------------------------------------------------------------
// Shared stubs
// ---------------------------------------------------------------------------

// Avoids Lizard quote-tracker bug: never put " inside string literals.
// Use this constant wherever a literal double-quote character is needed.
const DQ = '\x22';

const measurer: TextMeasurer = { measure: () => ({ w: 0, h: 0 }) };

export function makeJob(): RenderJob {
  return new RenderJob('json', measurer);
}

export function makeGraph(): Graph {
  const g = new Graph('G', 'directed');
  g.info.bb = { ll: { x: 0, y: 0 }, ur: { x: 200, y: 100 } };
  return g;
}

export function makeNode(g: Graph, name: string): Node {
  const n = new Node(0, name, g);
  n.info.coord = { x: 50, y: 40 };
  n.info.width = 1.0;
  n.info.height = 0.5;
  g.nodes.set(name, n);
  return n;
}

export function makeTwoNodeGraph(): Graph {
  const g = makeGraph();
  const a = makeNode(g, 'A');
  const b = makeNode(g, 'B');
  b.info.coord = { x: 100, y: 80 };
  const e = new Edge(a, b, '');
  g.edges.push(e);
  return g;
}

// ---------------------------------------------------------------------------
// stoj test bodies
// ---------------------------------------------------------------------------

export function testStojBasic(): void {
  expect(stoj('hello')).toBe(DQ + 'hello' + DQ);
}

export function testStojEscapes(): void {
  expect(stoj('a' + DQ + 'b')).toBe(DQ + 'a\\' + DQ + 'b' + DQ);
  expect(stoj('a\\b')).toBe(DQ + 'a\\\\b' + DQ);
  expect(stoj('a/b')).toBe(DQ + 'a\\/b' + DQ);
  expect(stoj('a\nb')).toBe(DQ + 'a\\nb' + DQ);
  expect(stoj('a\tb')).toBe(DQ + 'a\\tb' + DQ);
}

// ---------------------------------------------------------------------------
// ind test bodies
// ---------------------------------------------------------------------------

export function testInd(): void {
  expect(ind(0)).toBe('');
  expect(ind(1)).toBe('  ');
  expect(ind(2)).toBe('    ');
}

// ---------------------------------------------------------------------------
// buildJson / renderer test bodies
// ---------------------------------------------------------------------------

export function testJson0ValidJson(): void {
  const g = makeTwoNodeGraph();
  const out = buildJson(g, false);
  const parsed = JSON.parse(out) as Record<string, unknown>;
  expect(parsed['name']).toBe('G');
  expect(parsed['directed']).toBe(true);
}

export function testJson0ObjectsPos(): void {
  type G0 = { objects: Array<{ pos: string }> };
  const g = makeTwoNodeGraph();
  const parsed = JSON.parse(buildJson(g, false)) as G0;
  expect(Array.isArray(parsed.objects)).toBe(true);
  expect(typeof parsed.objects[0]!.pos).toBe('string');
}

export function testJson0EdgeIds(): void {
  type G0 = { edges: Array<{ tail: number; head: number }> };
  const g = makeTwoNodeGraph();
  const parsed = JSON.parse(buildJson(g, false)) as G0;
  expect(parsed.edges[0]!.tail).toBe(0);
  expect(parsed.edges[0]!.head).toBe(1);
}

export function testJsonDrawArray(): void {
  type G1 = { objects: Array<Record<string, unknown>> };
  const g = makeTwoNodeGraph();
  const parsed = JSON.parse(buildJson(g, true)) as G1;
  const first = parsed.objects[0]!;
  expect(Object.prototype.hasOwnProperty.call(first, '_draw_')).toBe(true);
}

export function testJson0Factory(): void {
  const r = createJson0Renderer();
  expect(r.type).toBe('json0');
  expect(r.quality).toBe(0);
}

export function testJsonFactory(): void {
  const r = createJsonRenderer();
  expect(r.type).toBe('json');
  expect(r.quality).toBe(0);
}

export function testJson0EndGraph(): void {
  const r = new Json0Renderer();
  const job = makeJob();
  const g = makeTwoNodeGraph();
  r.beginGraph(g, job);
  r.endGraph(g, job);
  const out = job.output.join('');
  const parsed = JSON.parse(out) as { objects: unknown[] };
  expect(parsed.objects).toHaveLength(2);
}

export function testJsonEndGraph(): void {
  const r = new JsonRenderer();
  const job = makeJob();
  const g = makeTwoNodeGraph();
  r.beginGraph(g, job);
  r.endGraph(g, job);
  const out = job.output.join('');
  type G1 = { objects: Array<Record<string, unknown>> };
  const parsed = JSON.parse(out) as G1;
  // JsonRenderer re-renders the laid-out graph to xdot (mirroring C's
  // json_begin_graph) and populates each node's `_draw_` with typed op
  // objects; a drawn node therefore carries a non-empty op array.
  const draw = parsed.objects[0]!['_draw_'];
  expect(Array.isArray(draw)).toBe(true);
  expect((draw as unknown[]).length).toBeGreaterThan(0);
}

// ---------------------------------------------------------------------------
// describe / it registrations
// ---------------------------------------------------------------------------

describe('stoj', () => {
  it('wraps plain strings in quotes', testStojBasic);
  it('escapes special characters', testStojEscapes);
});

describe('ind', () => {
  it('returns correct indentation strings', testInd);
});

describe('buildJson', () => {
  it('json0 output is valid JSON', testJson0ValidJson);
  it('objects[0].pos is a string', testJson0ObjectsPos);
  it('edge tail/head are node gvid integers', testJson0EdgeIds);
  it('json format adds _draw_ key to objects', testJsonDrawArray);
});

describe('Json0Renderer', () => {
  it('factory returns type=json0 quality=0', testJson0Factory);
  it('endGraph emits two objects', testJson0EndGraph);
});

describe('JsonRenderer', () => {
  it('factory returns type=json quality=0', testJsonFactory);
  it('endGraph emits _draw_ on objects', testJsonEndGraph);
});
