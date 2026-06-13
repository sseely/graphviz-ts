// SPDX-License-Identifier: EPL-2.0

/**
 * Graph-object escape substitution + node anchor pipeline.
 * Expected outputs verified against C graphviz 15.0.0 on 2026-06-12.
 * @see lib/common/labels.c:strdup_and_subst_obj0
 * @see lib/common/shapes.c:poly_gencode (doMap anchor)
 */

import { describe, it, expect } from 'vitest';
import { renderSvg } from '../index.js';
import { substObj, interpretCRNL } from './subst.js';
import { Graph } from '../model/graph.js';
import { Node } from '../model/node.js';

describe('substObj', () => {
  const g = new Graph('G7', 'directed');
  const n = new Node(0, 'A', g);

  it('resolves \\N and \\G for nodes', () => {
    expect(substObj('\\N in \\G', n, false)).toBe('A in G7');
  });

  it('leaves formatting escapes untouched', () => {
    expect(substObj('a\\nb \\N', n, false)).toBe('a\\nb A');
  });

  it('collapses \\\\ only with escBackslash', () => {
    expect(substObj('a\\\\b', n, false)).toBe('a\\\\b');
    expect(substObj('a\\\\b', n, true)).toBe('a\\b');
  });

  it('\\E is empty for non-edges; \\T stays literal', () => {
    expect(substObj('[\\E]', n, false)).toBe('[]');
    expect(substObj('[\\T]', n, false)).toBe('[\\T]');
  });
});

describe('interpretCRNL (emit.c:interpretCRNL)', () => {
  it('maps \\l to newline and drops unknown escape backslashes', () => {
    expect(interpretCRNL('a\\lb \\N')).toBe('a\nb N');
  });
});

describe('node label/anchor substitution end-to-end (C-verified)', () => {
  it('label \\N renders the node name', () => {
    expect(renderSvg('digraph { A [label="\\N x"] }', 'dot')).toContain('>A x</text>');
  });

  it('edge label \\E renders tail->head', () => {
    expect(renderSvg('digraph { A -> B [label="\\E"] }', 'dot')).toContain('>A-&gt;B</text>');
  });

  it('node href anchor with \\N substitution + label-default tooltip', () => {
    const svg = renderSvg('digraph { A [href="http://n/\\N" label="hi"] }', 'dot');
    expect(svg).toContain('<g id="a_node1"><a xlink:href="http://n/A" xlink:title="hi">');
  });

  it('tooltip-only node anchors; \\N in tooltips is literal N (preprocessTooltip)', () => {
    const svg = renderSvg('digraph { A [href="http://x" tooltip="node \\N"] }', 'dot');
    expect(svg).toContain('xlink:title="node N"');
  });

  it('target alone opens no anchor', () => {
    expect(renderSvg('digraph { A [target="_blank" label="hi"] }', 'dot')).not.toContain('<a ');
  });
});
