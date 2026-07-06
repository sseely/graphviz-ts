// SPDX-License-Identifier: EPL-2.0
//
// A rotated (rankdir=LR/RL) cluster with a label must reserve rank-axis room
// for that label. C's set_ycoords calls adjustRanks when `lbl && GD_flip`, and
// adjustRanks reads GD_border[LEFT/RIGHT] unconditionally. The port had gated
// its adjustRanksLabel on the *cluster's* info.flip, which is never propagated
// to subgraphs (only the root's is set), so the reservation was skipped and the
// drawing came out too small along the rank axis. Regression: 2239's
// cluster_dtlsdec1 (a PEM-certificate label) halved the LR width (12078 -> 6799).

import { describe, it, expect } from 'vitest';
import { renderSvg } from '../../index.js';

const dims = (svg: string): { w: number; h: number } => {
  const m = /<svg width="(\d+)pt" height="(\d+)pt"/.exec(svg);
  if (m === null) throw new Error('no <svg> dims');
  return { w: Number(m[1]), h: Number(m[2]) };
};

describe('LR cluster label reserves rank-axis room (adjustRanks flip path)', () => {
  const tallLabel = 'digraph { rankdir=LR; subgraph cluster_a { ' +
    'label="L1\\nL2\\nL3\\nL4\\nL5\\nL6\\nL7\\nL8"; a; } a -> b }';
  const noLabel = 'digraph { rankdir=LR; subgraph cluster_a { a; } a -> b }';

  it('an 8-line cluster label grows the drawing vs the unlabeled control', () => {
    const withLabel = renderSvg(tallLabel, 'dot');
    const control = renderSvg(noLabel, 'dot');
    // The reservation is real, not a no-op: the labelled drawing is larger.
    const dw = dims(withLabel), dc = dims(control);
    expect(dw.w * dw.h).toBeGreaterThan(dc.w * dc.h);
  });

  it('matches native dot 15.1.0 (168x218 with label, 168x76 without)', () => {
    expect(dims(renderSvg(tallLabel, 'dot'))).toEqual({ w: 168, h: 218 });
    expect(dims(renderSvg(noLabel, 'dot'))).toEqual({ w: 168, h: 76 });
  });
});
