// SPDX-License-Identifier: EPL-2.0

/**
 * Tests for svg-graph.ts bgcolor resolution and background polygon emission.
 *
 * Oracle-verified against dot 15.0.0 -Tsvg output.
 *
 * @see lib/common/emit.c:emit_background:1476
 * @see plugin/core/gvrender_core_svg.c:svg_begin_page
 */

import { describe, it, expect } from 'vitest';
import { RenderJob } from '../gvc/job.js';
import { SVG_PAD } from './svg-helpers.js';
import type { TextMeasurer } from '../common/textmeasure.js';
import type { Box } from '../model/geom.js';
import {
  resolveGraphBgcolor, emitGraphBackground, emitSvgTag, svgBeginPage,
} from './svg-graph.js';
import { renderSvg } from '../index.js';
import { createSvgRenderer } from './svg.js';
import { Graph as GraphClass } from '../model/graph.js';
import type { Graph } from '../model/graph.js';

const measurer: TextMeasurer = { measure: () => ({ w: 0, h: 0 }) };

// Job constructed directly (bypassing render()'s parseGraphPad call) must set
// job.pad explicitly, matching what render() resolves for a graph with no
// `pad=` attribute (SVG plugin default_pad, 4pt both axes).
function makeJob(): RenderJob {
  const j = new RenderJob('svg', measurer);
  j.bb = { ll: { x: 0, y: 0 }, ur: { x: 100, y: 80 } };
  j.pad = { x: SVG_PAD, y: SVG_PAD };
  return j;
}

const testBb: Box = { ll: { x: 0, y: 0 }, ur: { x: 100, y: 80 } };

// ---------------------------------------------------------------------------
// resolveGraphBgcolor — pure resolver
// ---------------------------------------------------------------------------

describe('resolveGraphBgcolor — default white', () => {
  it('returns "white" when bgcolor attr is absent', () => {
    // emit_background:1483-1485: if no bgcolor specified → "white"
    expect(resolveGraphBgcolor(undefined)).toBe('white');
  });

  it('returns "white" when bgcolor attr is empty string', () => {
    expect(resolveGraphBgcolor('')).toBe('white');
  });

  it('returns named color as-is', () => {
    expect(resolveGraphBgcolor('lightyellow')).toBe('lightyellow');
  });

  it('returns hex color as-is', () => {
    expect(resolveGraphBgcolor('#ffffcc')).toBe('#ffffcc');
  });
});

describe('resolveGraphBgcolor — transparent', () => {
  it('returns transparent sentinel for "transparent" on SVG (truecolor)', () => {
    // emit_background:1498-1499: SVG has GVDEVICE_DOES_TRUECOLOR → no polygon
    // We encode this as the BGCOLOR_TRANSPARENT sentinel (private constant).
    // The returned value is NOT 'white' and NOT 'transparent' — it is a sentinel
    // that causes emitGraphBackground to emit nothing.
    const result = resolveGraphBgcolor('transparent');
    expect(result).not.toBe('white');
    expect(result).not.toBe('transparent');
    // Round-trip: the sentinel suppresses the polygon
    const job = makeJob();
    emitGraphBackground(testBb, result, job);
    expect(job.output.join('')).toBe('');
  });
});

describe('resolveGraphBgcolor — gradient AD3', () => {
  it('returns first color from gradient spec', () => {
    // AD3: gradient "c1:c2" → first solid color
    expect(resolveGraphBgcolor('lightyellow:white')).toBe('lightyellow');
  });
});

// ---------------------------------------------------------------------------
// emitGraphBackground — polygon output
// ---------------------------------------------------------------------------

describe('emitGraphBackground — default white', () => {
  it('emits white polygon (byte-stable default)', () => {
    // Oracle: dot -Tsvg with no bgcolor → fill="white" stroke="none"
    const job = makeJob();
    emitGraphBackground(testBb, 'white', job);
    const out = job.output.join('');
    expect(out).toContain('fill="white"');
    expect(out).toContain('stroke="none"');
    expect(out).toContain('<polygon');
  });

  it('white polygon has same coords as original hardcoded white', () => {
    // Coordinate math unchanged: left=ll.x-4, right=ur.x+4, etc.
    const job = makeJob();
    emitGraphBackground(testBb, 'white', job);
    const out = job.output.join('');
    // With bb={ll:{0,0},ur:{100,80}}, SVG_PAD=4:
    // left=-4, right=104, top=-(84), bottom=4
    expect(out).toContain('-4,4');
    expect(out).toContain('-4,-84');
    expect(out).toContain('104,-84');
    expect(out).toContain('104,4');
  });
});

describe('emitGraphBackground — named bgcolor', () => {
  it('emits polygon with lightyellow fill', () => {
    // Oracle: digraph G {bgcolor=lightyellow;a} → fill="lightyellow" stroke="none"
    const job = makeJob();
    emitGraphBackground(testBb, 'lightyellow', job);
    const out = job.output.join('');
    expect(out).toContain('fill="lightyellow"');
    expect(out).toContain('stroke="none"');
    expect(out).toContain('<polygon');
  });

  it('lightyellow polygon has same coords as white (only color differs)', () => {
    const jobWhite = makeJob();
    const jobYellow = makeJob();
    emitGraphBackground(testBb, 'white', jobWhite);
    emitGraphBackground(testBb, 'lightyellow', jobYellow);
    const outW = jobWhite.output.join('').replace('fill="white"', 'fill="X"');
    const outY = jobYellow.output.join('').replace('fill="lightyellow"', 'fill="X"');
    // Same coords — only color differs
    expect(outW).toBe(outY);
  });
});

describe('emitGraphBackground — transparent omits polygon', () => {
  it('emits nothing when resolvedColor is the transparent sentinel', () => {
    // Oracle: digraph G {bgcolor=transparent} on SVG → no background polygon
    const job = makeJob();
    const sentinel = resolveGraphBgcolor('transparent');
    emitGraphBackground(testBb, sentinel, job);
    expect(job.output.join('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// End-to-end: two-color bgcolor → gradient background (G4)
// Verified against C graphviz 15.0.0 (dot -Tsvg).
// ---------------------------------------------------------------------------

describe('graph bgcolor gradient — end to end', () => {
  it('bgcolor="red:blue" emits a linearGradient defs + url background', () => {
    const svg = renderSvg('digraph G { bgcolor="red:blue"; a }', 'dot');
    expect(svg).toContain('<defs>');
    // root graph obj has id "graph0", so the gradient id is prefixed
    expect(svg).toContain('<linearGradient id="graph0_l_0"');
    expect(svg).toContain('stop-color:red');
    expect(svg).toContain('stop-color:blue');
    // background polygon now references the gradient instead of a solid fill
    expect(svg).toContain('<polygon fill="url(#graph0_l_0)" stroke="none"');
  });

  it('solid bgcolor stays a solid polygon (no gradient defs)', () => {
    const svg = renderSvg('digraph G { bgcolor=lightyellow; a }', 'dot');
    expect(svg).not.toContain('<linearGradient');
    expect(svg).toContain('<polygon fill="lightyellow" stroke="none"');
  });
});

// ---------------------------------------------------------------------------
// Landscape rotation (orientation=land mission T2). Numbers pinned to b68.gv
// native: padded bb 638 x 213 (bb.ur = 630 x 204.5, pad 4) renders rotated as
// width="213pt" height="638pt", scale(1 1) rotate(-90) translate(-634 208.5).
// @see lib/common/emit.c:setup_page; gvrender_core_svg.c:svg_begin_page
// ---------------------------------------------------------------------------

/** Job with b68's padded-bb geometry (bb.ur = 630 x 204.5; pad 4 → 638 x 213). */
function b68Job(rotation: number): RenderJob {
  const job = new RenderJob('svg', measurer);
  job.zoom = 1;
  job.scale = { x: 1, y: 1 };
  job.devscale = { x: 1, y: -1 };
  job.translation = { x: 0, y: 0 };
  job.rotation = rotation;
  job.bb = { ll: { x: 0, y: 0 }, ur: { x: 630, y: 204.5 } };
  job.pad = { x: SVG_PAD, y: SVG_PAD };
  job.renderer = createSvgRenderer();
  return job;
}

describe('emitSvgTag — landscape dim swap', () => {
  it('portrait (rotation 0): width=638 height=213, unswapped', () => {
    const job = b68Job(0);
    emitSvgTag(job);
    const o = job.output.join('');
    expect(o).toContain('<svg width="638pt" height="213pt"');
    expect(o).toContain('viewBox="0.00 0.00 638.00 213.00"');
  });

  it('landscape (rotation 90): width=213 height=638, swapped', () => {
    const job = b68Job(90);
    emitSvgTag(job);
    const o = job.output.join('');
    expect(o).toContain('<svg width="213pt" height="638pt"');
    expect(o).toContain('viewBox="0.00 0.00 213.00 638.00"');
  });
});

describe('svgBeginPage — landscape group transform (b68 canary)', () => {
  it('portrait (rotation 0): rotate(0) translate(4 208.5), unchanged', () => {
    const g = new GraphClass('simple', 'directed') as unknown as Graph;
    const job = b68Job(0);
    svgBeginPage(g, job);
    expect(job.output.join('')).toContain(
      'transform="scale(1 1) rotate(0) translate(4 208.5)"',
    );
  });

  it('landscape (rotation 90): rotate(-90) translate(-634 208.5) — b68 native', () => {
    const g = new GraphClass('simple', 'directed') as unknown as Graph;
    const job = b68Job(90);
    svgBeginPage(g, job);
    expect(job.output.join('')).toContain(
      'transform="scale(1 1) rotate(-90) translate(-634 208.5)"',
    );
  });
});

describe('renderSvg — landscape wiring (parseLandscape -> job.rotation -> emit)', () => {
  it('rotate=90 emits rotate(-90); portrait emits rotate(0)', () => {
    const land = renderSvg('digraph { rotate=90; a -> b }', 'dot');
    expect(land).toContain('rotate(-90)');
    const portrait = renderSvg('digraph { a -> b }', 'dot');
    expect(portrait).toContain('rotate(0)');
    expect(portrait).not.toContain('rotate(-90)');
  });

  it('landscape swaps <svg> width/height vs the same portrait graph', () => {
    const portrait = renderSvg('digraph { a -> b }', 'dot');
    const land = renderSvg('digraph { orientation=land; a -> b }', 'dot');
    const dims = (svg: string): [string, string] => {
      const m = /<svg width="(\d+)pt" height="(\d+)pt"/.exec(svg);
      if (m === null) throw new Error('no <svg> dims');
      return [m[1], m[2]];
    };
    const [pw, ph] = dims(portrait);
    const [lw, lh] = dims(land);
    expect(lw).toBe(ph);
    expect(lh).toBe(pw);
  });
});

// ---------------------------------------------------------------------------
// dpi / resolution graph attribute. init_job_dpi (emit.c:3333) reads
// GD_drawing->dpi (input.c:713, dpi then resolution then 0); when 0 the SVG
// device's default_dpi=72 (gvrender_core_svg.c:814) applies. init_job_viewport
// sets job->scale = zoom * dpi/72 (emit.c:3680) and job->width/height scale by
// the same factor (emit.c:1249). The port carries this in job.scale, so the SVG
// group transform + dims scale by dpi/72. Regression: 2619_1/2 (dpi=96) emitted
// scale(1 1) and a 3/4-size viewBox. Oracle-verified: `digraph{a}` at dpi=72 is
// unchanged; dpi=96 scales the group + dims by exactly 96/72 = 1.33333.
// ---------------------------------------------------------------------------

describe('dpi / resolution graph attribute — SVG group + dim scaling', () => {
  const dims = (svg: string): { w: number; h: number } => {
    const m = /<svg width="(\d+)pt" height="(\d+)pt"/.exec(svg);
    if (m === null) throw new Error('no <svg> dims');
    return { w: Number(m[1]), h: Number(m[2]) };
  };

  it('no dpi attribute: scale(1 1), dims unchanged (72dpi no-op)', () => {
    const svg = renderSvg('digraph { a -> b }', 'dot');
    expect(svg).toContain('transform="scale(1 1)');
  });

  it('dpi=96 scales the group transform by 96/72 = 1.33333', () => {
    const svg = renderSvg('digraph { dpi=96; a -> b }', 'dot');
    expect(svg).toContain('transform="scale(1.33333 1.33333)');
  });

  it('dpi=96 scales <svg> width/height (native dot 15.1.0: 62x116 -> 83x155)', () => {
    // Oracle-pinned: `digraph{a->b}` is 62x116pt at 72dpi; at dpi=96 the whole
    // drawing scales to 83x155pt. C rounds unrounded_sz*dpi/72, not the rounded
    // 72dpi dims, so this is pinned to native output rather than a base*4/3 ratio.
    expect(dims(renderSvg('digraph { a -> b }', 'dot'))).toEqual({ w: 62, h: 116 });
    expect(dims(renderSvg('digraph { dpi=96; a -> b }', 'dot'))).toEqual({ w: 83, h: 155 });
  });

  it('resolution=96 is an alias for dpi (init_job_dpi fallback)', () => {
    const svg = renderSvg('digraph { resolution=96; a -> b }', 'dot');
    expect(svg).toContain('transform="scale(1.33333 1.33333)');
  });

  it('dpi=72 explicitly is a no-op (scale 1 1)', () => {
    const svg = renderSvg('digraph { dpi=72; a -> b }', 'dot');
    expect(svg).toContain('transform="scale(1 1)');
  });
});

// ---------------------------------------------------------------------------
// pad= graph attribute (F2). Oracle-verified against native dot 15.1.0
// (GVBINDIR=/tmp/ghl dot -Tsvg): `pad=2` on `digraph G { a -> b }` yields
// width="342pt" height="396pt" translate(144 252); no-pad default is
// unchanged at width="62pt" height="116pt" translate(4 112).
// @see lib/common/emit.c:3241-3251 (attr read); :3290-3304 (init_job_pad)
// ---------------------------------------------------------------------------

describe('pad= graph attribute — F2 regression (native dot 15.1.0 oracle)', () => {
  it('pad="2" (144pt) expands svg dims, viewBox, and group translate', () => {
    const svg = renderSvg('digraph G { pad="2"; a -> b }', 'dot');
    expect(svg).toContain('<svg width="342pt" height="396pt"');
    expect(svg).toContain('viewBox="0.00 0.00 342.00 396.00"');
    expect(svg).toContain('translate(144 252)');
    expect(svg).toContain(
      '<polygon fill="white" stroke="none" points="-144,144 -144,-252 198,-252 198,144 -144,144"/>',
    );
  });

  it('no pad= attribute: default 4pt unaffected (byte-stable baseline)', () => {
    const svg = renderSvg('digraph G { a -> b }', 'dot');
    expect(svg).toContain('<svg width="62pt" height="116pt"');
    expect(svg).toContain('translate(4 112)');
  });

  it('single-value pad="0.5" (36pt) — both axes scale together', () => {
    const svg = renderSvg('digraph G { pad="0.5"; a -> b }', 'dot');
    // content bb 54x108 + 2*36 = 126x180, Z=1 (no size=)
    expect(svg).toContain('<svg width="126pt" height="180pt"');
    expect(svg).toContain('translate(36 144)');
  });

  it('two-value pad="0.5,0" — independent x/y axes', () => {
    const svg = renderSvg('digraph G { pad="0.5,0"; a -> b }', 'dot');
    // x pad = 36pt, y pad = 0pt: width=54+72=126, height=108+0=108
    expect(svg).toContain('<svg width="126pt" height="108pt"');
    expect(svg).toContain('translate(36 108)');
  });
});

// ---------------------------------------------------------------------------
// margin= graph attribute (F6). Oracle-verified against native dot 15.1.0
// (GVBINDIR=/tmp/ghl dot -Tsvg): `margin="0.8"` on `digraph G { a -> b }`
// yields width="177pt" height="231pt" viewBox="58.00 58.00 120.00 174.00"
// translate(61.6 169.6); `margin="1,0.5"` yields width="206pt" height="188pt"
// viewBox="72.00 36.00 134.00 152.00" translate(76 148). No-margin baseline
// is unchanged (D5 analogue).
// @see lib/common/emit.c:3229-3239 (attr read); :3309-3331 (init_job_margin)
// @see lib/common/emit.c:1191-1300 init_job_pagination (width/height/viewBox)
// @see lib/common/emit.c:1532-1583 setup_page (translation)
// ---------------------------------------------------------------------------

describe('margin= graph attribute — F6 regression (native dot 15.1.0 oracle)', () => {
  it('margin="0.8" (57.6pt) expands svg dims, viewBox, and group translate', () => {
    const svg = renderSvg('digraph G { margin="0.8"; a -> b }', 'dot');
    expect(svg).toContain('<svg width="177pt" height="231pt"');
    expect(svg).toContain('viewBox="58.00 58.00 120.00 174.00"');
    expect(svg).toContain('translate(61.6 169.6)');
  });

  it('two-value margin="1,0.5" — independent x/y axes', () => {
    const svg = renderSvg('digraph G { margin="1,0.5"; a -> b }', 'dot');
    expect(svg).toContain('<svg width="206pt" height="188pt"');
    expect(svg).toContain('viewBox="72.00 36.00 134.00 152.00"');
    expect(svg).toContain('translate(76 148)');
  });

  it('no margin= attribute: byte-stable baseline (viewBox starts at 0,0)', () => {
    const svg = renderSvg('digraph G { a -> b }', 'dot');
    expect(svg).toContain('<svg width="62pt" height="116pt"');
    expect(svg).toContain('viewBox="0.00 0.00 62.00 116.00"');
    expect(svg).toContain('translate(4 112)');
  });

  it('margin= does not perturb the background polygon (job->clip, not canvasBox)', () => {
    const withMargin = renderSvg('digraph G { margin="0.8"; a -> b }', 'dot');
    const withoutMargin = renderSvg('digraph G { a -> b }', 'dot');
    const poly = (svg: string): string | null =>
      /<polygon fill="white"[^/]*\/>/.exec(svg)?.[0] ?? null;
    expect(poly(withMargin)).toBe(poly(withoutMargin));
  });

  it('rotate=90 + margin: width/height swap base but margin.x/y stay unswapped', () => {
    // Oracle: digraph G { rotate=90; margin="1,0.5"; a -> b } ->
    // width="260pt" height="134pt" viewBox="72.00 36.00 188.00 98.00"
    // translate(-130 148).
    const svg = renderSvg('digraph G { rotate=90; margin="1,0.5"; a -> b }', 'dot');
    expect(svg).toContain('<svg width="260pt" height="134pt"');
    expect(svg).toContain('viewBox="72.00 36.00 188.00 98.00"');
    expect(svg).toContain('translate(-130 148)');
  });
});
