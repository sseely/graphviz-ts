// SPDX-License-Identifier: EPL-2.0
/**
 * Channel extraction and search for the ortho maze.
 *
 * @see lib/ortho/ortho.c:extractHChans, extractVChans, chanSearch
 */

import type { Cell, Maze, Channel, ChanItem, ChanDict, Paird } from "./types.js";
import { MZ_HSCAN, MZ_VSCAN, MZ_ISNODE, M_LEFT, M_RIGHT, M_TOP, M_BOTTOM } from "./types.js";
import { makeGraph } from "./rawgraph.js";
import { CdtOset } from "./chan-dict.js";

export { makeGraph };

function isNode(cp: Cell): boolean {
  return (cp.flags & MZ_ISNODE) !== 0;
}

/** dcmpid: plain double comparison (fcmp). @see lib/ortho/ortho.c:dcmpid */
function dcmpid(a: number, b: number): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** New empty two-level channel dict (outer Dtoset keyed by v). */
export function newChanDict(): ChanDict {
  return new CdtOset<ChanItem, number>((it) => it.v, dcmpid);
}

/**
 * Insert channel cp under line j — C addChan: dtmatch the chanItem for j
 * (creating it on miss), then dtinsert cp into its inner Dtoset. When the
 * inner insert finds an "equal" channel (chancmpid containment) it returns
 * the existing one and the new cp is dropped (C frees it).
 * @see lib/ortho/ortho.c:addChan
 */
function addChan(chdict: ChanDict, cp: Channel, j: number): void {
  let subd = chdict.match(j);
  if (!subd) {
    subd = { v: j, chans: new CdtOset<Channel, Paird>((c) => c.p, chancmpid) };
    chdict.insert(subd);
  }
  subd.chans.insert(cp); // existing-on-containment: cp silently dropped
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
export function extractHChans(mp: Maze): ChanDict {
  const hchans = newChanDict();
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
export function extractVChans(mp: Maze): ChanDict {
  const vchans = newChanDict();
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
 * Walk channels exactly as C's assignTracks-family loops do:
 *   for (l1 = dtflatten(chans); l1; l1 = dtlink(chans,l1))
 *     for (l2 = dtflatten(lp); l2; l2 = dtlink(lp,l2))
 * dtflatten right-linearises the splay tree into a sorted chain, and dtlink
 * follows raw `.right` pointers LIVE. When the loop body performs a
 * chanSearch (dtmatch), the dict is unflattened and re-splayed mid-walk, so
 * the `.right` chain the walker follows is rewritten under it — C then
 * silently SKIPS every channel a rotation moved into a left subtree. This
 * corrupted-walk behavior is deterministic and load-bearing for the
 * parallel-edge pass (corpus 1447_1/osage: C visits 157 of 294 channels).
 * The generator reads `.right` lazily at each resume, reproducing it.
 * @see lib/ortho/ortho.c:assignTracks, add_p_edges (dtflatten walks)
 * @see src/ortho/chan-dict.ts (flatten/unflatten mechanics)
 */
export function* chansInOrder(chans: ChanDict): Generator<[number, Channel]> {
  for (let l1 = chans.flatten(); l1 !== null; l1 = l1.right) {
    const item = l1.obj;
    for (let l2 = item.chans.flatten(); l2 !== null; l2 = l2.right) {
      yield [item.v, l2.obj];
    }
  }
}

/**
 * Interval comparison — faithful port of ortho.c:chancmpid. Two intervals are
 * "equal" (return 0) when one CONTAINS the other (nested either way); otherwise
 * the one with the smaller p1 is less. C's chanSearch relies on this so a
 * segment that extends BEYOND its channel (segment ⊇ channel, e.g. an edge whose
 * endpoint reaches out to a node/label past the channel's cell) still matches —
 * a one-directional `chan ⊇ seg` test misses that case and drops the segment.
 * @see lib/ortho/ortho.c:chancmpid
 */
function chancmpid(k1: { p1: number; p2: number }, k2: { p1: number; p2: number }): number {
  if (k1.p1 > k2.p1) {
    if (k1.p2 <= k2.p2) return 0;
    return 1;
  }
  if (k1.p1 < k2.p1) {
    if (k1.p2 >= k2.p2) return 0;
    return -1;
  }
  return 0;
}

/**
 * Find the channel whose interval nests with the segment (chancmpid == 0).
 * Both lookups are C dtmatch calls: they SPLAY the dicts, which is what
 * corrupts any dtflatten walk in progress (see chansInOrder).
 * @see lib/ortho/ortho.c:chanSearch
 */
export function chanSearch(
  chans: ChanDict,
  commCoord: number,
  p: { p1: number; p2: number },
): Channel | null {
  const chani = chans.match(commCoord);
  if (!chani) return null;
  return chani.chans.match(p);
}
