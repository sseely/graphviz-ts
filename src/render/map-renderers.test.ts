// SPDX-License-Identifier: EPL-2.0

import { describe, it, expect } from 'vitest';
import {
  PlainRenderer,
  PlainExtRenderer,
  ImapRenderer,
  ImapNpRenderer,
  CmapxRenderer,
  CmapxNpRenderer,
  createPlainRenderer,
  createPlainExtRenderer,
  createImapRenderer,
  createImapNpRenderer,
  createCmapxRenderer,
  createCmapxNpRenderer,
} from './map.js';
import { makeJob, makeObjState, makeGraph, makeNode } from './map-test-helpers.js';
import { MapShape } from '../gvc/job.js';
import type { Point } from '../model/geom.js';

// ---------------------------------------------------------------------------
// Avoid Lizard quote-tracker bug: never put " inside string literals.
// ---------------------------------------------------------------------------

const DQ = '\x22';

// ---------------------------------------------------------------------------
// Factory test bodies
// ---------------------------------------------------------------------------

export function testPlainFactory(): void {
  const r = createPlainRenderer();
  expect(r.type).toBe('plain');
  expect(r.quality).toBe(0);
}

export function testPlainExtFactory(): void {
  const r = createPlainExtRenderer();
  expect(r.type).toBe('plain-ext');
  expect(r.quality).toBe(0);
}

export function testImapFactory(): void {
  const r = createImapRenderer();
  expect(r.type).toBe('imap');
  expect(r.quality).toBe(0);
}

export function testImapNpFactory(): void {
  const r = createImapNpRenderer();
  expect(r.type).toBe('imap-np');
  expect(r.quality).toBe(0);
}

export function testCmapxFactory(): void {
  const r = createCmapxRenderer();
  expect(r.type).toBe('cmapx');
  expect(r.quality).toBe(0);
}

export function testCmapxNpFactory(): void {
  const r = createCmapxNpRenderer();
  expect(r.type).toBe('cmapx-np');
  expect(r.quality).toBe(0);
}

// ---------------------------------------------------------------------------
// PlainRenderer integration test bodies
// ---------------------------------------------------------------------------

export function testPlainEndGraph(): void {
  const r = new PlainRenderer();
  const job = makeJob();
  const g = makeGraph();
  makeNode(g, 'A');
  r.beginGraph(g, job);
  r.endGraph(g, job);
  const out = job.output.join('');
  expect(out).toContain('graph ');
  expect(out).toContain('node A');
  expect(out).toContain('stop');
}

export function testPlainExtEndGraph(): void {
  const r = new PlainExtRenderer();
  const job = makeJob();
  const g = makeGraph();
  makeNode(g, 'A');
  r.endGraph(g, job);
  expect(job.output.join('')).toContain('stop');
}

// ---------------------------------------------------------------------------
// ImapRenderer integration test bodies
// ---------------------------------------------------------------------------

export function testImapBeginGraph(): void {
  const r = new ImapRenderer();
  const job = makeJob();
  r.beginGraph(makeGraph(), job);
  expect(job.output.join('')).toContain('base referer');
}

export function testImapBeginAnchorNoMap(): void {
  const r = new ImapRenderer();
  const job = makeJob();
  const before = job.output.length;
  r.beginAnchor?.('http://x.com', '', '', '', job);
  expect(job.output.length).toBe(before);
}

export function testImapNpBeginGraph(): void {
  const r = new ImapNpRenderer();
  const job = makeJob();
  r.beginGraph(makeGraph(), job);
  expect(job.output.join('')).toContain('base referer');
}

export function testImapNpBeginAnchorNoMap(): void {
  const r = new ImapNpRenderer();
  const job = makeJob();
  const before = job.output.length;
  r.beginAnchor?.('http://x.com', '', '', '', job);
  expect(job.output.length).toBe(before);
}

// ---------------------------------------------------------------------------
// CmapxRenderer integration test bodies
// ---------------------------------------------------------------------------

export function testCmapxBeginGraph(): void {
  const r = new CmapxRenderer();
  const job = makeJob();
  r.beginGraph(makeGraph(), job);
  const out = job.output.join('');
  expect(out).toContain('<map id=' + DQ + 'G' + DQ);
  expect(out).toContain('name=' + DQ + 'G' + DQ);
}

export function testCmapxEndGraph(): void {
  const r = new CmapxRenderer();
  const job = makeJob();
  r.endGraph(makeGraph(), job);
  expect(job.output.join('')).toContain('</map>');
}

export function testCmapxBeginAnchorNoMap(): void {
  const r = new CmapxRenderer();
  const job = makeJob();
  const before = job.output.length;
  r.beginAnchor?.('http://x.com', 'tip', '_blank', 'n1', job);
  expect(job.output.length).toBe(before);
}

export function testCmapxBeginAnchorWithMap(): void {
  const r = new CmapxRenderer();
  const job = makeJob();
  const obj = makeObjState();
  obj.urlMapShape = MapShape.Rectangle;
  obj.urlMapPts = [{ x: 10, y: 80 }, { x: 90, y: 20 }] as Point[];
  job.pushObj(obj);
  r.beginAnchor?.('http://x.com', 'tip', '_blank', 'n1', job);
  const out = job.output.join('');
  expect(out).toContain('<area shape=' + DQ + 'rect' + DQ);
  expect(out).toContain('href=' + DQ + 'http://x.com' + DQ);
}

// ---------------------------------------------------------------------------
// CmapxNpRenderer integration test bodies
// ---------------------------------------------------------------------------

export function testCmapxNpBeginGraph(): void {
  const r = new CmapxNpRenderer();
  const job = makeJob();
  r.beginGraph(makeGraph(), job);
  expect(job.output.join('')).toContain('<map id=' + DQ + 'G' + DQ);
}

export function testCmapxNpEndGraph(): void {
  const r = new CmapxNpRenderer();
  const job = makeJob();
  r.endGraph(makeGraph(), job);
  expect(job.output.join('')).toContain('</map>');
}

// ---------------------------------------------------------------------------
// describe / it registrations
// ---------------------------------------------------------------------------

describe('PlainRenderer', () => {
  it('factory returns type=plain quality=0', testPlainFactory);
  it('endGraph writes full plain output', testPlainEndGraph);
});

describe('PlainExtRenderer', () => {
  it('factory returns type=plain-ext quality=0', testPlainExtFactory);
  it('endGraph writes plain output', testPlainExtEndGraph);
});

describe('ImapRenderer', () => {
  it('factory returns type=imap quality=0', testImapFactory);
  it('beginGraph writes base referer', testImapBeginGraph);
  it('beginAnchor no-op without map pts', testImapBeginAnchorNoMap);
});

describe('ImapNpRenderer', () => {
  it('factory returns type=imap-np quality=0', testImapNpFactory);
  it('beginGraph writes base referer', testImapNpBeginGraph);
  it('beginAnchor no-op without map pts', testImapNpBeginAnchorNoMap);
});

describe('CmapxRenderer', () => {
  it('factory returns type=cmapx quality=0', testCmapxFactory);
  it('beginGraph emits map open tag', testCmapxBeginGraph);
  it('endGraph emits map close tag', testCmapxEndGraph);
  it('beginAnchor no-op without map pts', testCmapxBeginAnchorNoMap);
  it('beginAnchor emits area when map pts present', testCmapxBeginAnchorWithMap);
});

describe('CmapxNpRenderer', () => {
  it('factory returns type=cmapx-np quality=0', testCmapxNpFactory);
  it('beginGraph emits map open tag', testCmapxNpBeginGraph);
  it('endGraph emits map close tag', testCmapxNpEndGraph);
});
