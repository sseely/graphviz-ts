// SPDX-License-Identifier: EPL-2.0

import { describe, it, expect } from 'vitest';
import {
  parseStyleFlags,
  resolvePenType,
  resolvePenWidth,
  resolveNodeFill,
  resolvePenColor,
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

  it('ignores setlinewidth(3) token', () => {
    const f = parseStyleFlags('filled,setlinewidth(3)');
    expect(f.filled).toBe(true);
    expect(f.bold).toBe(false);
  });

  it('skips parens content, keeps trailing flags', () => {
    const f = parseStyleFlags('setlinewidth(2),dashed');
    expect(f.dashed).toBe(true);
    expect(f.filled).toBe(false);
  });

  it('trims whitespace around tokens', () => {
    const f = parseStyleFlags(' filled , dashed ');
    expect(f.filled).toBe(true);
    expect(f.dashed).toBe(true);
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
