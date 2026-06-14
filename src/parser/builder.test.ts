// SPDX-License-Identifier: EPL-2.0

/**
 * Edge port/compass wiring: DOT syntax `A:port:compass` lands in the edge's
 * tailport/headport attrs (the C path: mkport sets the attr, common_init_edge
 * reads it). Explicit headport=/tailport= attrs win over DOT syntax.
 *
 * @see lib/cgraph/grammar.y:396 (mkport)
 * @see lib/common/utils.c:common_init_edge (port block)
 */

import { describe, it, expect } from 'vitest';
import { parse } from './index.js';

function firstEdge(src: string) {
  return parse(src).edges[0]!;
}

describe('edge port/compass → tailport/headport attrs', () => {
  it('A:s -> B:n sets tailport="s", headport="n"', () => {
    const e = firstEdge('digraph { A:s -> B:n; }');
    expect(e.attrs.get('tailport')).toBe('s');
    expect(e.attrs.get('headport')).toBe('n');
  });

  it('A:f0:ne -> B sets tailport="f0:ne" (port:compass joined)', () => {
    const e = firstEdge('digraph { A:f0:ne -> B; }');
    expect(e.attrs.get('tailport')).toBe('f0:ne');
    expect(e.attrs.get('headport')).toBeUndefined();
  });

  it('no port syntax leaves tailport/headport unset', () => {
    const e = firstEdge('digraph { A -> B; }');
    expect(e.attrs.get('tailport')).toBeUndefined();
    expect(e.attrs.get('headport')).toBeUndefined();
  });

  it('explicit tailport= attr wins over DOT syntax', () => {
    const e = firstEdge('digraph { A:s -> B [tailport="e"]; }');
    expect(e.attrs.get('tailport')).toBe('e');
  });

  it('explicit tailport= attr alone is preserved', () => {
    const e = firstEdge('digraph { A -> B [tailport="e"]; }');
    expect(e.attrs.get('tailport')).toBe('e');
  });
});
