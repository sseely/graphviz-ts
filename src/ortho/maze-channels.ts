// SPDX-License-Identifier: EPL-2.0
/**
 * Channel extraction and search for the ortho maze.
 *
 * @see lib/ortho/ortho.c:extractHChans, extractVChans, chanSearch
 */

import type { Cell, Maze, Channel } from "./types.js";
import { MZ_HSCAN, MZ_VSCAN, MZ_ISNODE, M_LEFT, M_RIGHT, M_TOP, M_BOTTOM } from "./types.js";
import { makeGraph } from "./rawgraph.js";

export { makeGraph };

function isNode(cp: Cell): boolean {
  return (cp.flags & MZ_ISNODE) !== 0;
}

function chanKey(p: { p1: number; p2: number }): string {
  return `${p.p1}~${p.p2}`;
}

function addChan(
  chdict: Map<number, Map<string, Channel>>,
  cp: Channel,
  j: number,
): void {
  let sub = chdict.get(j);
  if (!sub) { sub = new Map(); chdict.set(j, sub); }
  const k = chanKey(cp.p);
  if (!sub.has(k)) sub.set(k, cp);
}

function moveLeft(cp: Cell): Cell {
  let cur = cp;
  while (true) {
    const np = cur.sides[M_LEFT];
    if (!np) break;
    const nextcp = np.cells[0];
    if (!nextcp || isNode(nextcp)) break;
    cur = nextcp;
  }
  return cur;
}

function moveRight(cp: Cell): Cell {
  let cur = cp;
  while (true) {
    const np = cur.sides[M_RIGHT];
    if (!np) break;
    const nextcp = np.cells[1];
    if (!nextcp || isNode(nextcp)) break;
    cur.flags |= MZ_HSCAN;
    cur = nextcp;
  }
  cur.flags |= MZ_HSCAN;
  return cur;
}

function moveDown(cp: Cell): Cell {
  let cur = cp;
  while (true) {
    const np = cur.sides[M_BOTTOM];
    if (!np) break;
    const nextcp = np.cells[0];
    if (!nextcp || isNode(nextcp)) break;
    cur = nextcp;
  }
  return cur;
}

function moveUp(cp: Cell): Cell {
  let cur = cp;
  while (true) {
    const np = cur.sides[M_TOP];
    if (!np) break;
    const nextcp = np.cells[1];
    if (!nextcp || isNode(nextcp)) break;
    cur.flags |= MZ_VSCAN;
    cur = nextcp;
  }
  cur.flags |= MZ_VSCAN;
  return cur;
}

/**
 * Extract horizontal channels from the maze.
 * @see lib/ortho/ortho.c:extractHChans
 */
export function extractHChans(mp: Maze): Map<number, Map<string, Channel>> {
  const hchans: Map<number, Map<string, Channel>> = new Map();
  for (let i = 0; i < mp.ncells; i++) {
    const cp = mp.cells[i];
    if (cp.flags & MZ_HSCAN) continue;
    const cur = moveLeft(cp);
    const chp: Channel = { p: { p1: cur.bb.LL.x, p2: 0 }, segList: [], G: null, cp: cur };
    cur.flags |= MZ_HSCAN;
    const end = moveRight(cur);
    chp.p.p2 = end.bb.UR.x;
    addChan(hchans, chp, cur.bb.LL.y);
  }
  return hchans;
}

/**
 * Extract vertical channels from the maze.
 * @see lib/ortho/ortho.c:extractVChans
 */
export function extractVChans(mp: Maze): Map<number, Map<string, Channel>> {
  const vchans: Map<number, Map<string, Channel>> = new Map();
  for (let i = 0; i < mp.ncells; i++) {
    const cp = mp.cells[i];
    if (cp.flags & MZ_VSCAN) continue;
    const cur = moveDown(cp);
    const chp: Channel = { p: { p1: cur.bb.LL.y, p2: 0 }, segList: [], G: null, cp: cur };
    cur.flags |= MZ_VSCAN;
    const end = moveUp(cur);
    chp.p.p2 = end.bb.UR.y;
    addChan(vchans, chp, cur.bb.LL.x);
  }
  return vchans;
}

/**
 * Find the channel containing a segment (interval containment).
 * @see lib/ortho/ortho.c:chanSearch
 */
export function chanSearch(
  chans: Map<number, Map<string, Channel>>,
  commCoord: number,
  p: { p1: number; p2: number },
): Channel | null {
  const sub = chans.get(commCoord);
  if (!sub) return null;
  for (const [, chan] of sub) {
    if (chan.p.p1 <= p.p1 && chan.p.p2 >= p.p2) return chan;
  }
  return null;
}
