// SPDX-License-Identifier: EPL-2.0

import { describe, it, expect } from 'vitest';
import {
  parseStyleFlags,
  resolvePenType,
  resolvePenWidth,
  resolveNodeFill,
  resolvePenColor,
  resolveClusterFill,
} from './style-resolve.js';
import { PenType } from '../gvc/context.js';

describe('parseStyleFlags — empty input', () => {
  it('all-false part1 for undefined', () => {
    const f = parseStyleFlags(undefined);
    expect(f.filled).toBe(false);
    expect(f.dashed).toBe(false);
    expect(f.dotted).toBe(false);
    expect(f.bold).toBe(false);
    expect(f.invis).toBe(false);
  });

  it('all-false part2 for undefined', () => {
    const f = parseStyleFlags(undefined);
    expect(f.diagonals).toBe(false);
    expect(f.rounded).toBe(false);
    expect(f.radial).toBe(false);
    expect(f.striped).toBe(false);
    expect(f.wedged).toBe(false);
  });
});

describe('parseStyleFlags — single flags', () => {
  it('parses filled alone', () => {
    const f = parseStyleFlags('filled');
    expect(f.filled).toBe(true);
    expect(f.dashed).toBe(false);
  });

  it('parses filled,dashed', () => {
    const f = parseStyleFlags('filled,dashed');
    expect(f.filled).toBe(true);
    expect(f.dashed).toBe(true);
    expect(f.dotted).toBe(false);
  });

  it('parses first five flags', () => {
    const f = parseStyleFlags('filled,dashed,dotted,bold,invis');
    expect(f.filled).toBe(true);
    expect(f.dashed).toBe(true);
    expect(f.dotted).toBe(true);
    expect(f.bold).toBe(true);
    expect(f.invis).toBe(true);
  });
});

describe('parseStyleFlags — remaining flags and edge cases', () => {
  it('parses last five flags', () => {
    const f = parseStyleFlags('diagonals,rounded,radial,striped,wedged');
    expect(f.diagonals).toBe(true);
    expect(f.rounded).toBe(true);
    expect(f.radial).toBe(true);
    expect(f.striped).toBe(true);
    expect(f.wedged).toBe(true);
  });

  it('trims whitespace around tokens', () => {
    const f = parseStyleFlags(' filled , dashed ');
    expect(f.filled).toBe(true);
    expect(f.dashed).toBe(true);
  });

  // C matches the style token with streq(p, "invis") (exact); "invisible" is an
  // unrecognized token, ignored, so the object is still drawn (graphviz 1898:
  // N19 [shape=point style=invisible] renders an ellipse in native dot).
  // @see lib/common/shapes.c:495 / lib/common/emit.c:1823 (streq(p,"invis"))
  it('treats "invisible" as an unknown token, not invis', () => {
    const f = parseStyleFlags('invisible');
    expect(f.invis).toBe(false);
  });
});

describe('parseStyleFlags — setlinewidth + FUNLIMIT', () => {
  it('captures setlinewidth(3) pen width and keeps other flags', () => {
    // lib/gvc/gvrender.c:501 — setlinewidth → atof of paren argument
    const f = parseStyleFlags('filled,setlinewidth(3)');
    expect(f.filled).toBe(true);
    expect(f.bold).toBe(false);
    expect(f.setLineWidth).toBe(3);
  });

  it('captures setlinewidth and keeps trailing flags', () => {
    const f = parseStyleFlags('setlinewidth(2),dashed');
    expect(f.dashed).toBe(true);
    expect(f.filled).toBe(false);
    expect(f.setLineWidth).toBe(2);
  });

  it('ignores unknown parenthesized tokens (not setlinewidth)', () => {
    const f = parseStyleFlags('filled,tapered(4)');
    expect(f.filled).toBe(true);
    expect(f.setLineWidth).toBeNull();
  });
});

describe('parseStyleFlags — FUNLIMIT truncation', () => {
  it('truncates to an empty style list at FUNLIMIT (64) tokens', () => {
    // lib/common/emit.c:4046 — parse_style returns early at the 64th token,
    // skipping the list-construction loop → no flags apply.
    const f63 = parseStyleFlags(Array(63).fill('filled').join(','));
    expect(f63.filled).toBe(true);
    const f64 = parseStyleFlags(Array(64).fill('filled').join(','));
    expect(f64.filled).toBe(false);
    const f65 = parseStyleFlags(Array(65).fill('filled').join(','));
    expect(f65.filled).toBe(false);
  });
});

describe('resolvePenType', () => {
  const base = parseStyleFlags('');

  it('returns Solid when no dash flags set', () => {
    expect(resolvePenType(base)).toBe(PenType.Solid);
  });

  it('returns Dashed when dashed flag is set', () => {
    expect(resolvePenType({ ...base, dashed: true })).toBe(PenType.Dashed);
  });

  it('returns Dotted when only dotted flag is set', () => {
    expect(resolvePenType({ ...base, dotted: true })).toBe(PenType.Dotted);
  });

  it('dashed wins when both dashed and dotted are set', () => {
    // lib/gvc/gvrender.c:493 — dashed checked before dotted
    expect(resolvePenType({ ...base, dashed: true, dotted: true })).toBe(
      PenType.Dashed,
    );
  });
});

describe('resolvePenWidth — defaults', () => {
  const base = parseStyleFlags('');

  it('returns 1.0 with no flags and no attr', () => {
    expect(resolvePenWidth(base, undefined)).toBe(1.0);
  });

  it('returns 2.0 (PENWIDTH_BOLD) when bold flag set', () => {
    // lib/gvc/gvcjob.h:41 — PENWIDTH_BOLD = 2.0
    expect(resolvePenWidth({ ...base, bold: true }, undefined)).toBe(2.0);
  });

  it('returns 1.5 for attr "1.5"', () => {
    expect(resolvePenWidth(base, '1.5')).toBe(1.5);
  });
});

describe('resolvePenWidth — attr precedence', () => {
  const base = parseStyleFlags('');

  it('explicit attr "3" wins over bold flag', () => {
    // lib/common/shapes.c:539-541 — N_penwidth applied before stylenode returns
    expect(resolvePenWidth({ ...base, bold: true }, '3')).toBe(3.0);
  });

  it('non-numeric attr falls back to bold', () => {
    expect(resolvePenWidth({ ...base, bold: true }, 'notanumber')).toBe(2.0);
  });

  it('non-numeric attr falls back to 1.0 when no bold', () => {
    expect(resolvePenWidth(base, 'notanumber')).toBe(1.0);
  });

  it('empty string attr falls back to bold', () => {
    expect(resolvePenWidth({ ...base, bold: true }, '')).toBe(2.0);
  });
});

describe('resolveNodeFill — unfilled cases', () => {
  it('not filled when style omits filled keyword', () => {
    const r = resolveNodeFill({ style: 'dashed' });
    expect(r.filled).toBe(false);
    expect(r.color).toBe('');
  });

  it('not filled when style is undefined', () => {
    expect(resolveNodeFill({}).filled).toBe(false);
  });
});

describe('resolveNodeFill — fill color defaults', () => {
  it('defaults to lightgrey when filled with no color attrs', () => {
    // lib/common/const.h:69 — DEFAULT_FILL = "lightgrey"
    // lib/common/shapes.c:419 — findFill → findFillDflt(n, DEFAULT_FILL)
    const r = resolveNodeFill({ style: 'filled' });
    expect(r.filled).toBe(true);
    expect(r.color).toBe('lightgrey');
  });

  it('uses fillcolor attr when set', () => {
    const r = resolveNodeFill({ style: 'filled', fillcolor: 'red' });
    expect(r.filled).toBe(true);
    expect(r.color).toBe('red');
  });

  it('falls back to color attr when fillcolor absent', () => {
    // lib/common/shapes.c:407-408 — backward compat: fill = pen color
    const r = resolveNodeFill({ style: 'filled', color: 'blue' });
    expect(r.filled).toBe(true);
    expect(r.color).toBe('blue');
  });
});

describe('resolveNodeFill — fill color precedence and gradients', () => {
  it('fillcolor takes precedence over color', () => {
    const r = resolveNodeFill({
      style: 'filled',
      fillcolor: 'green',
      color: 'blue',
    });
    expect(r.color).toBe('green');
  });

  it('extracts first color from gradient fillcolor (AD3)', () => {
    const r = resolveNodeFill({ style: 'filled', fillcolor: 'red:blue' });
    expect(r.filled).toBe(true);
    expect(r.color).toBe('red');
  });

  it('extracts first color from gradient color fallback', () => {
    const r = resolveNodeFill({ style: 'filled', color: 'cyan:magenta' });
    expect(r.color).toBe('cyan');
  });
});

describe('resolvePenColor', () => {
  it('returns "black" for undefined', () => {
    // lib/common/const.h:48 — DEFAULT_COLOR = "black"
    // lib/common/shapes.c:394-395 — if !color[0] use DEFAULT_COLOR
    expect(resolvePenColor(undefined)).toBe('black');
  });

  it('returns "black" for empty string', () => {
    expect(resolvePenColor('')).toBe('black');
  });

  it('returns hex color as-is', () => {
    expect(resolvePenColor('#ff0000')).toBe('#ff0000');
  });

  it('returns named color as-is', () => {
    expect(resolvePenColor('red')).toBe('red');
  });

  it('extracts first color from colorList', () => {
    expect(resolvePenColor('red:blue')).toBe('red');
  });
});

// ---------------------------------------------------------------------------
// resolveClusterFill — @see lib/common/emit.c:emit_clusters:3805-3853
// ---------------------------------------------------------------------------

describe('resolveClusterFill — unfilled cluster', () => {
  it('unfilled with no attrs: filled=false, penColor=black', () => {
    // Byte-gate: unfilled cluster → fill="none" stroke="black"
    const r = resolveClusterFill({});
    expect(r.filled).toBe(false);
    expect(r.penColor).toBe('black');
  });

  it('unfilled with style=dashed: filled=false, penColor=black', () => {
    const r = resolveClusterFill({ style: 'dashed' });
    expect(r.filled).toBe(false);
    expect(r.penColor).toBe('black');
  });
});

describe('resolveClusterFill — style=filled defaults', () => {
  it('style=filled with no color attrs: lightgrey fill, black pen', () => {
    // C: subgraph cluster_0{style=filled;a} → fill="lightgrey" stroke="black"
    // emit_clusters:3852-3853: if !pencolor → "black"; if !fillcolor → "lightgrey"
    const r = resolveClusterFill({ style: 'filled' });
    expect(r.filled).toBe(true);
    expect(r.fillColor).toBe('lightgrey');
    expect(r.penColor).toBe('black');
  });
});

describe('resolveClusterFill — color attr sets both', () => {
  it('color=lightgrey with style=filled: fill and pen both lightgrey', () => {
    // C: subgraph cluster_0{style=filled;color=lightgrey;a}
    //    → fill="lightgrey" stroke="lightgrey"
    // emit_clusters:3835-3836: color sets both fillcolor and pencolor
    const r = resolveClusterFill({ style: 'filled', color: 'lightgrey' });
    expect(r.filled).toBe(true);
    expect(r.fillColor).toBe('lightgrey');
    expect(r.penColor).toBe('lightgrey');
  });

  it('color=blue with style=filled: fill and pen both blue', () => {
    const r = resolveClusterFill({ style: 'filled', color: 'blue' });
    expect(r.filled).toBe(true);
    expect(r.fillColor).toBe('blue');
    expect(r.penColor).toBe('blue');
  });
});

describe('resolveClusterFill — pencolor and fillcolor override', () => {
  it('pencolor overrides pen portion of color', () => {
    // emit_clusters:3837-3838: pencolor attr overrides pen
    const r = resolveClusterFill({
      style: 'filled',
      color: 'blue',
      pencolor: 'red',
    });
    expect(r.filled).toBe(true);
    expect(r.fillColor).toBe('blue');
    expect(r.penColor).toBe('red');
  });

  it('fillcolor overrides fill portion of color', () => {
    // emit_clusters:3839-3840: fillcolor attr overrides fill
    const r = resolveClusterFill({
      style: 'filled',
      color: 'blue',
      fillcolor: 'green',
    });
    expect(r.filled).toBe(true);
    expect(r.fillColor).toBe('green');
    expect(r.penColor).toBe('blue');
  });
});

describe('resolveClusterFill — bgcolor backward-compat', () => {
  it('bgcolor fills unfilled cluster (no style=filled)', () => {
    // C: subgraph cluster_0{bgcolor=lightpink;a}
    //    → fill="lightpink" stroke="black"
    // emit_clusters:3846-3849: if filled==0 && bgcolor → fillcolor=bgcolor; filled=FILL
    const r = resolveClusterFill({ bgcolor: 'lightpink' });
    expect(r.filled).toBe(true);
    expect(r.fillColor).toBe('lightpink');
    expect(r.penColor).toBe('black');
  });

  it('bgcolor fills cluster when fillcolor not set even if filled', () => {
    // emit_clusters:3846: (!filled || !fillcolor) condition
    const r = resolveClusterFill({ style: 'filled', bgcolor: 'lightpink' });
    expect(r.filled).toBe(true);
    // fillcolor not set, so bgcolor wins
    expect(r.fillColor).toBe('lightpink');
    expect(r.penColor).toBe('black');
  });

  it('bgcolor ignored when fillcolor already set', () => {
    // emit_clusters:3846: fillcolor trumps bgcolor
    const r = resolveClusterFill({
      style: 'filled',
      fillcolor: 'green',
      bgcolor: 'lightpink',
    });
    expect(r.fillColor).toBe('green');
  });
});

describe('resolveClusterFill — penwidth and gradient (AD3)', () => {
  it('gradient fillcolor returns first color only', () => {
    // AD3: two-color/gradient → first solid color
    const r = resolveClusterFill({ style: 'filled', fillcolor: 'red:blue' });
    expect(r.filled).toBe(true);
    expect(r.fillColor).toBe('red');
  });

  it('gradient color attr returns first color for both pen and fill', () => {
    const r = resolveClusterFill({ style: 'filled', color: 'cyan:magenta' });
    expect(r.fillColor).toBe('cyan');
    expect(r.penColor).toBe('cyan');
  });
});
