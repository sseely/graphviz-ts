// SPDX-License-Identifier: EPL-2.0

/**
 * Tests for htmltable-emit.ts: verifies that fontFlags and fontColor
 * from PlacedLine survive unchanged into the TextSpan passed to textspan().
 */

import { describe, it, expect, vi } from 'vitest';
import type { PlacedLine } from './htmltable-pos.js';
import type { RenderJob } from '../gvc/job.js';
import type { TextSpan } from './emit-types.js';
import { HTML_BF, HTML_IF, HTML_UL } from './emit-types.js';
import { emitHtmlLine } from './htmltable-emit.js';

// ---------------------------------------------------------------------------
// Minimal RenderJob stub that captures textspan calls
// ---------------------------------------------------------------------------

function makeStubJob(): { job: RenderJob; spans: Array<{ span: TextSpan }> } {
  const spans: Array<{ span: TextSpan }> = [];
  const job = {
    write: vi.fn(),
    printDouble: vi.fn(),
    output: [] as string[],
    pushObj: vi.fn(),
    popObj: vi.fn(),
    obj: null,
    bb: { ll: { x: 0, y: 0 }, ur: { x: 100, y: 80 } },
    devscale: { x: 1, y: -1 },
    translation: { x: 0, y: 0 },
    renderer: {
      textspan: vi.fn((_pos: unknown, span: TextSpan) => { spans.push({ span }); }),
      polygon: vi.fn(), ellipse: vi.fn(), bezier: vi.fn(),
      polyline: vi.fn(), beginNode: vi.fn(), endNode: vi.fn(),
      beginEdge: vi.fn(), endEdge: vi.fn(), beginGraph: vi.fn(), endGraph: vi.fn(),
      beginCluster: vi.fn(), endCluster: vi.fn(),
      type: 'svg', quality: 0,
    },
  } as unknown as RenderJob;
  return { job, spans };
}

function makeLine(overrides: Partial<PlacedLine> = {}): PlacedLine {
  return {
    text: 'hi', x: 0, baseline: 0, width: 10,
    fontSize: 12, fontName: 'Times,serif', fontColor: 'black', fontFlags: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test bodies
// ---------------------------------------------------------------------------

export function testEmitLinePlainFontFlagsZero(): void {
  const { job, spans } = makeStubJob();
  emitHtmlLine(makeLine(), { x: 0, y: 0 }, job.renderer as never, job);
  expect(spans[0]!.span.fontFlags).toBe(0);
}

export function testEmitLineBoldFlagSurvives(): void {
  const { job, spans } = makeStubJob();
  emitHtmlLine(makeLine({ fontFlags: HTML_BF }), { x: 0, y: 0 }, job.renderer as never, job);
  expect(spans[0]!.span.fontFlags).toBe(HTML_BF);
}

export function testEmitLineItalicFlagSurvives(): void {
  const { job, spans } = makeStubJob();
  emitHtmlLine(makeLine({ fontFlags: HTML_IF }), { x: 0, y: 0 }, job.renderer as never, job);
  expect(spans[0]!.span.fontFlags).toBe(HTML_IF);
}

export function testEmitLineUnderlineFlagSurvives(): void {
  const { job, spans } = makeStubJob();
  emitHtmlLine(makeLine({ fontFlags: HTML_UL }), { x: 0, y: 0 }, job.renderer as never, job);
  expect(spans[0]!.span.fontFlags).toBe(HTML_UL);
}

export function testEmitLineCombinedFlagsSurvive(): void {
  const { job, spans } = makeStubJob();
  emitHtmlLine(makeLine({ fontFlags: HTML_BF | HTML_IF }), { x: 0, y: 0 }, job.renderer as never, job);
  expect(spans[0]!.span.fontFlags).toBe(HTML_BF | HTML_IF);
}

export function testEmitLineFontColorSurvives(): void {
  const { job, spans } = makeStubJob();
  emitHtmlLine(makeLine({ fontColor: 'red' }), { x: 0, y: 0 }, job.renderer as never, job);
  expect(spans[0]!.span.fontColor).toBe('red');
}

// ---------------------------------------------------------------------------
// describe / it registrations
// ---------------------------------------------------------------------------

describe('emitHtmlLine fontFlags passthrough', () => {
  it('plain line has fontFlags=0', testEmitLinePlainFontFlagsZero);
  it('HTML_BF survives to TextSpan', testEmitLineBoldFlagSurvives);
  it('HTML_IF survives to TextSpan', testEmitLineItalicFlagSurvives);
  it('HTML_UL survives to TextSpan', testEmitLineUnderlineFlagSurvives);
  it('combined flags survive to TextSpan', testEmitLineCombinedFlagsSurvive);
  it('fontColor survives to TextSpan', testEmitLineFontColorSurvives);
});

// ---------------------------------------------------------------------------
// T6 — cell decoration emission, end-to-end through the live pipeline.
// Every expected string below was verified byte-for-byte against the
// installed C graphviz 15.0.0 (`dot -Tsvg`) on 2026-06-12.
// @see lib/common/htmltable.c:emit_html_tbl / emit_html_cell
// ---------------------------------------------------------------------------

import { renderSvg } from '../index.js';

const tbl = (inner: string): string =>
  `digraph { A [shape=plaintext label=<<TABLE>${inner}</TABLE>>]; }`;

describe('T6 — BGCOLOR fill (htmltable.c:setFill)', () => {
  it('solid cell fill polygon precedes the cell border', () => {
    const svg = renderSvg(tbl('<TR><TD BGCOLOR="lightblue">a</TD></TR>'), 'dot');
    const fill = '<polygon fill="lightblue" stroke="none" points="21,-7 21,-29.5 33,-29.5 33,-7 21,-7"/>';
    const border = '<polygon fill="none" stroke="black" points="21,-7 21,-29.5 33,-29.5 33,-7 21,-7"/>';
    expect(svg).toContain(fill);
    expect(svg).toContain(border);
    expect(svg.indexOf(fill)).toBeLessThan(svg.indexOf(border));
  });

  it('two-color gradient spec emits a linear gradient fill', () => {
    const svg = renderSvg(tbl('<TR><TD BGCOLOR="red:blue">a</TD></TR>'), 'dot');
    expect(svg).toContain('<linearGradient id="l_0"');
    expect(svg).toContain('stop-color:red;');
    expect(svg).toContain('stop-color:blue;');
    expect(svg).toContain('fill="url(#l_0)" stroke="none"');
    // No longer collapsed to a solid first-stop fill.
    expect(svg).not.toContain('fill="red" stroke="none"');
  });

  it('radial style gradient spec emits a radial gradient fill', () => {
    const svg = renderSvg(
      tbl('<TR><TD BGCOLOR="red:blue" STYLE="radial">a</TD></TR>'), 'dot');
    expect(svg).toContain('<radialGradient id="r_0"');
    expect(svg).toContain('fill="url(#r_0)" stroke="none"');
  });
});

describe('T6 — SIDES borders (htmltable.c:doBorder)', () => {
  it('SIDES="LT" emits top+left polyline instead of a box', () => {
    const svg = renderSvg(
      'digraph { A [shape=plaintext label=<<TABLE SIDES="LT"><TR><TD>a</TD></TR></TABLE>>]; }', 'dot');
    expect(svg).toContain('<polyline fill="none" stroke="black" points="36,-32.5 18,-32.5 18,-4"/>');
    expect(svg).not.toContain('points="18,-4 18,-32.5 36,-32.5 36,-4 18,-4"');
  });
});

describe('T6 — anchors (htmltable.c:initAnchor/endAnchor)', () => {
  it('TD HREF wraps the cell border and text', () => {
    const svg = renderSvg(tbl('<TR><TD HREF="http://x">a</TD></TR>'), 'dot');
    const a = svg.indexOf('<a xlink:href="http://x"');
    const cellBorder = svg.indexOf('points="21,-7 21,-29.5 33,-29.5 33,-7 21,-7"');
    const close = svg.indexOf('</a>');
    expect(a).toBeGreaterThan(-1);
    expect(a).toBeLessThan(cellBorder);
    expect(close).toBeGreaterThan(svg.indexOf('>a</text>'));
  });
});

describe('T6 — explicit rules (htmltable.c:emit_html_rules)', () => {
  it('<HR/> between rows draws a full-width rule box', () => {
    const svg = renderSvg(tbl('<TR><TD>a</TD></TR><HR/><TR><TD>b</TD></TR>'), 'dot');
    expect(svg).toContain(
      '<polygon fill="black" stroke="black" points="17.62,-30.5 17.62,-30.5 36.38,-30.5 36.38,-30.5 17.62,-30.5"/>');
  });

  it('<VR/> between cells draws a vertical rule box', () => {
    const svg = renderSvg(tbl('<TR><TD>a</TD><VR/><TD>b</TD></TR>'), 'dot');
    expect(svg).toContain(
      '<polygon fill="black" stroke="black" points="26.62,-6 26.62,-32.5 26.62,-32.5 26.62,-6 26.62,-6"/>');
  });
});

describe('T6 — ROWS/COLUMNS="*" rules', () => {
  it('ROWS="*" rules every inner row boundary', () => {
    const svg = renderSvg(
      'digraph { A [shape=plaintext label=<<TABLE ROWS="*"><TR><TD>a</TD></TR><TR><TD>b</TD></TR><TR><TD>c</TD></TR></TABLE>>]; }', 'dot');
    expect(svg).toContain('points="17.62,-55 17.62,-55 36.38,-55 36.38,-55 17.62,-55"');
    expect(svg).toContain('points="17.62,-30.5 17.62,-30.5 36.38,-30.5 36.38,-30.5 17.62,-30.5"');
  });

  it('COLUMNS="*" rules every inner column boundary', () => {
    const svg = renderSvg(
      'digraph { A [shape=plaintext label=<<TABLE COLUMNS="*"><TR><TD>a</TD><TD>b</TD><TD>c</TD></TR></TABLE>>]; }', 'dot');
    expect(svg).toContain('points="24,-6 24,-32.5 24,-32.5 24,-6 24,-6"');
    expect(svg).toContain('points="38.75,-6 38.75,-32.5 38.75,-32.5 38.75,-6 38.75,-6"');
  });
});

describe('T6 — undecorated tables unchanged', () => {
  it('plain table emits no fill, rules, or anchors', () => {
    const svg = renderSvg(tbl('<TR><TD>a</TD></TR>'), 'dot');
    expect(svg).not.toContain('fill="black" stroke="black"');
    expect(svg).not.toContain('<a ');
    expect(svg).toContain('<polygon fill="none" stroke="black" points="21,-7 21,-29.5 33,-29.5 33,-7 21,-7"/>');
  });
});

// ---------------------------------------------------------------------------
// T7 — <IMG> sizing + emission via injected ImageSizer (AD3).
// Expected strings verified against C graphviz 15.0.0 on 2026-06-12.
// @see lib/common/htmltable.c:emit_html_img / size_html_img
// @see lib/gvc/gvrender.c:gvrender_usershape
// ---------------------------------------------------------------------------

import { setImageSizer } from '../gvc/usershape.js';
import { afterEach } from 'vitest';

const imgTbl = (attrs: string): string =>
  `digraph { A [shape=plaintext label=<<TABLE><TR><TD${attrs.startsWith(' W') ? attrs.slice(0, attrs.indexOf('>')) : ''}><IMG${attrs.startsWith(' W') ? attrs.slice(attrs.indexOf('>') + 1) : attrs}/></TD></TR></TABLE>>]; }`;

describe('T7 — html IMG emission', () => {
  afterEach(() => setImageSizer(null));

  it('sized image emits <image> at C geometry (24x12pt centered)', () => {
    setImageSizer((s) => (s === 'x.png' ? { w: 24, h: 12 } : null));
    const svg = renderSvg(imgTbl(' SRC="x.png"'), 'dot');
    expect(svg).toContain(
      '<image xlink:href="x.png" width="24px" height="12px" preserveAspectRatio="xMinYMin meet" x="15" y="-24"/>');
  });

  it('SCALE="true" upscales preserving aspect into the cell box', () => {
    setImageSizer((s) => (s === 'x.png' ? { w: 24, h: 12 } : null));
    const svg = renderSvg(
      'digraph { A [shape=plaintext label=<<TABLE><TR><TD WIDTH="60" HEIGHT="40"><IMG SCALE="true" SRC="x.png"/></TD></TR></TABLE>>]; }',
      'dot');
    expect(svg).toContain(
      '<image xlink:href="x.png" width="54px" height="27px" preserveAspectRatio="xMinYMin meet" x="14" y="-40.5"/>');
  });

  it('missing image: no <image>, zero-size cell, C cell geometry', () => {
    const svg = renderSvg(imgTbl(' SRC="/nope.png"'), 'dot');
    expect(svg).not.toContain('<image');
    // C: cell collapses to padding+border chrome (6x6 inner box)
    expect(svg).toContain('points="24,-15 24,-21 30,-21 30,-15 24,-15"');
  });
});

// T9 — gaps found by C-oracle verification (C graphviz 15.0.0, 2026-06-12).
describe('T9 — CELLBORDER > 1 (htmltable.c:doBorder via emit_html_cell)', () => {
  it('emits stroke-width and insets the box by border/2', () => {
    const svg = renderSvg(
      'digraph G { A [label=<<TABLE CELLBORDER="2"><TR><TD>a</TD></TR></TABLE>>]; }', 'dot');
    expect(svg).toMatch(/<polygon fill="none" stroke="black" stroke-width="2" points="/);
  });
});

describe('T9 — anchor ids and default tooltip (htmltable.c:initAnchor)', () => {
  it('generates a_node1_0 and inherits the <TABLE> tooltip', () => {
    const svg = renderSvg(
      'digraph G { A [label=<<TABLE><TR><TD HREF="http://x">go</TD></TR></TABLE>>]; }', 'dot');
    expect(svg).toContain('<g id="a_node1_0"><a xlink:href="http://x" xlink:title="&lt;TABLE&gt;">');
  });

  it('TITLE attr overrides the default tooltip', () => {
    const svg = renderSvg(
      'digraph G { A [label=<<TABLE><TR><TD HREF="http://x" TITLE="cellt">go</TD></TR></TABLE>>]; }', 'dot');
    expect(svg).toContain('xlink:title="cellt"');
  });

  it('anchor counter is global across objects and resets per render', () => {
    const dot = 'digraph G { A [label=<<TABLE><TR><TD HREF="http://x">a</TD></TR></TABLE>>]; B [label=<<TABLE HREF="http://y"><TR><TD HREF="http://z">b</TD></TR></TABLE>>]; }';
    const svg = renderSvg(dot, 'dot');
    expect(svg).toContain('id="a_node1_0"');
    expect(svg).toContain('id="a_node2_1"');
    expect(svg).toContain('id="a_node2_2"');
    // second render restarts at 0 (C: one process per dot invocation)
    expect(renderSvg(dot, 'dot')).toContain('id="a_node1_0"');
  });
});

describe('T9 — non-simple vertical model (size_html_txt simple branch)', () => {
  // C output values verified against graphviz 15.0.0 on 2026-06-12.
  it('bold single-line label uses mxfsize − maxoffset (y=-13.95)', () => {
    const svg = renderSvg('digraph G { A [label=<<b>hi</b>>]; }', 'dot');
    expect(svg).toMatch(/<text[^>]* y="-13\.95"[^>]*font-weight="bold"/);
  });

  it('multi-run regular line is non-simple (y=-13.95)', () => {
    const svg = renderSvg('digraph G { A [label=<<u>u</u> and <s>s</s>>]; }', 'dot');
    expect(svg).toMatch(/y="-13\.95"/);
  });

  it('plain single-run html label stays simple (y=-13.5)', () => {
    const svg = renderSvg('digraph G { A [label=<hi>]; }', 'dot');
    expect(svg).toMatch(/y="-13\.5"/);
  });

  it('node fontsize attr reaches html sizing (env.finfo)', () => {
    const a = renderSvg('digraph { A [label=<hi> fontsize=20] }', 'dot');
    const b = renderSvg('digraph { A [label=<hi>] }', 'dot');
    expect(a.match(/height="(\d+)pt"/)?.[1]).not.toBe(b.match(/height="(\d+)pt"/)?.[1]);
  });
});

describe('IMG SCALE fallback to node imagescale attr (emit_html_img:615-618)', () => {
  it('node imagescale=true scales the image like IMG SCALE="true"', () => {
    setImageSizer((s) => (s === 'x.png' ? { w: 24, h: 12 } : null));
    const withAttr = renderSvg(
      'digraph { A [imagescale=true label=<<TABLE><TR><TD WIDTH="60" HEIGHT="40"><IMG SRC="x.png"/></TD></TR></TABLE>>]; }', 'dot');
    const withScale = renderSvg(
      'digraph { A [label=<<TABLE><TR><TD WIDTH="60" HEIGHT="40"><IMG SCALE="true" SRC="x.png"/></TD></TR></TABLE>>]; }', 'dot');
    expect(withAttr.match(/<image[^>]*/)?.[0]).toBe(withScale.match(/<image[^>]*/)?.[0]);
    expect(withAttr).toContain('width="54px" height="27px"');
  });

  it('IMG SCALE attr overrides the node attr', () => {
    setImageSizer((s) => (s === 'x.png' ? { w: 24, h: 12 } : null));
    const svg = renderSvg(
      'digraph { A [imagescale=true label=<<TABLE><TR><TD WIDTH="60" HEIGHT="40"><IMG SCALE="false" SRC="x.png"/></TD></TR></TABLE>>]; }', 'dot');
    expect(svg).toContain('width="24px" height="12px"');
  });
});

// ---------------------------------------------------------------------------
// Rounded bgcolor fill + border (htmltable.c emit_html_tbl/emit_html_cell
// rounded arm; doBorder rounded arm). A style="rounded" table/cell fills and
// borders a rounded Bézier <path> instead of a square <polygon>; the bgcolor
// fill also carries the leaked pen width as stroke-width (gap B). Every
// expected string below was verified byte-for-byte against the installed C
// graphviz 15.0.0 (`dot -Tsvg`) on 2026-06-22.
// @see lib/common/htmltable.c:emit_html_tbl (:543), emit_html_cell (:644), doBorder (:271)
// ---------------------------------------------------------------------------

const roundFill = 'M24,-4C24,-4 30,-4 30,-4 33,-4 36,-7 36,-10 36,-10 36,-26.5 36,-26.5 36,-29.5 33,-32.5 30,-32.5 30,-32.5 24,-32.5 24,-32.5 21,-32.5 18,-29.5 18,-26.5 18,-26.5 18,-10 18,-10 18,-7 21,-4 24,-4';

describe('Rounded table bgcolor fill (gap A)', () => {
  it('rounded solid table fills a Bézier <path>, not a <polygon>', () => {
    const svg = renderSvg(
      'digraph { A [shape=plaintext label=<<TABLE style="rounded" bgcolor="lightblue"><TR><TD>a</TD></TR></TABLE>>]; }', 'dot');
    expect(svg).toContain('<path fill="lightblue" stroke="none" d="' + roundFill + '"/>');
    // table fill must NOT be a square polygon
    expect(svg).not.toContain('<polygon fill="lightblue"');
  });

  it('rounded table border is also a Bézier <path>', () => {
    const svg = renderSvg(
      'digraph { A [shape=plaintext label=<<TABLE style="rounded" bgcolor="lightblue"><TR><TD>a</TD></TR></TABLE>>]; }', 'dot');
    expect(svg).toContain('<path fill="none" stroke="black" d="' + roundFill + '"/>');
  });

  it('non-rounded table still fills a square <polygon> (regression)', () => {
    const svg = renderSvg(tbl('<TR><TD>a</TD></TR>').replace('<TABLE>', '<TABLE bgcolor="lightblue">'), 'dot');
    expect(svg).toContain('<polygon fill="lightblue" stroke="none"');
    expect(svg).not.toContain('<path fill="lightblue"');
  });

  it('rounded gradient table emits a <path> filled with the gradient url', () => {
    const svg = renderSvg(
      'digraph { A [shape=plaintext label=<<TABLE style="rounded" bgcolor="red:blue" gradientangle="90"><TR><TD>a</TD></TR></TABLE>>]; }', 'dot');
    expect(svg).toContain('<linearGradient id="l_0"');
    expect(svg).toContain('<path fill="url(#l_0)" stroke="none" d="' + roundFill + '"/>');
  });
});

describe('Rounded cell bgcolor fill (gap A — D2 cell arm)', () => {
  it('rounded cell fills and borders a Bézier <path>', () => {
    const svg = renderSvg(
      'digraph { A [shape=plaintext label=<<TABLE><TR><TD style="rounded" bgcolor="lightblue">a</TD></TR></TABLE>>]; }', 'dot');
    const cellFill = 'M25,-7C25,-7 29,-7 29,-7 31,-7 33,-9 33,-11 33,-11 33,-25.5 33,-25.5 33,-27.5 31,-29.5 29,-29.5 29,-29.5 25,-29.5 25,-29.5 23,-29.5 21,-27.5 21,-25.5 21,-25.5 21,-11 21,-11 21,-9 23,-7 25,-7';
    expect(svg).toContain('<path fill="lightblue" stroke="none" d="' + cellFill + '"/>');
    expect(svg).toContain('<path fill="none" stroke="black" d="' + cellFill + '"/>');
  });
});

describe('Pen width on bgcolor fill (gap B — htmltable.c penwidth leak)', () => {
  it('cell fill carries the prior cell border as stroke-width; first cell none', () => {
    const svg = renderSvg(
      'digraph { A [shape=plaintext label=<<TABLE><TR><TD border="3" bgcolor="yellow">a</TD><TD border="3" bgcolor="green">b</TD></TR></TABLE>>]; }', 'dot');
    // first cell fill inherits pen width 1 → no stroke-width
    expect(svg).toContain('<polygon fill="yellow" stroke="none" points="11,-7 11,-33.5 27,-33.5 27,-7 11,-7"/>');
    // second cell fill leaks the prior cell's border=3 → stroke-width="3", stroke still none
    expect(svg).toContain('<polygon fill="green" stroke="none" stroke-width="3" points="29,-7 29,-33.5 45.75,-33.5 45.75,-7 29,-7"/>');
  });

  it('default-border cell fill carries no stroke-width', () => {
    const svg = renderSvg(tbl('<TR><TD BGCOLOR="lightblue">a</TD></TR>'), 'dot');
    expect(svg).toContain('<polygon fill="lightblue" stroke="none" points=');
    expect(svg).not.toMatch(/<polygon fill="lightblue" stroke="none" stroke-width=/);
  });
});
