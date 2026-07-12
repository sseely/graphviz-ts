// SPDX-License-Identifier: EPL-2.0
/**
 * Unit fixture for `addPEdges` (`lib/ortho/ortho.c:918-1010`) — the
 * parallel-segment precedence pass that R4 diagnosed as missing (mission
 * residual-cleanup, corpus 1447_1). Before this port, two segments occupying
 * the exact same channel position (`is_parallel`) got no ordering edge at
 * all: `seg_cmp` reports them tied (0), so `addNpEdges`/`add_edges_in_G`
 * inserts nothing, and `top_sort` is free to place them in either track.
 * `addPEdges` resolves the tie by walking each segment's route outward
 * until the two chains diverge, then encoding that divergence as an
 * explicit precedence edge in the channel's ordering graph.
 *
 * This fixture uses the minimal case: two standalone segments (no
 * `prev`/`next` route context) that are otherwise identical — same p-range,
 * same bend directions — sharing one channel. With zero hops to a
 * divergence point, `decide_point` returns `prec=0` for both directions and
 * `set_parallel_edges` degenerates to its zero-hop base case, inserting the
 * edge directly into the channel graph.
 *
 * @see lib/ortho/ortho.c:addPEdges, add_p_edges, is_parallel, decide_point
 */

import { describe, it, expect } from "vitest";
import { addPEdgesAll } from "./ortho-parallel.js";
import { makeGraph, edgeExists } from "./rawgraph.js";
import { newChanDict } from "./maze-channels.js";
import { CdtOset } from "./chan-dict.js";
import { Bend } from "./types.js";
import type { OrthoSegment, Channel, ChanItem, Paird, Maze, SGraph } from "./types.js";

function parallelSegment(indNo: number): OrthoSegment {
  return {
    isVert: false,
    commCoord: 100,
    p: { p1: 10, p2: 50 },
    l1: Bend.B_NODE,
    l2: Bend.B_NODE,
    indNo,
    trackNo: null,
    prev: null,
    next: null,
  };
}

/** A single horizontal channel holding two fully-parallel segments. */
function makeSharedChannel(): Channel {
  const seg0 = parallelSegment(0);
  const seg1 = parallelSegment(1);
  return {
    p: { p1: seg0.p.p1, p2: seg0.p.p2 },
    segList: [seg0, seg1],
    G: makeGraph(2),
    cp: null,
  };
}

function makeMaze(chan: Channel): Maze {
  const hchans = newChanDict();
  const item: ChanItem = {
    v: chan.segList[0].commCoord,
    chans: new CdtOset<Channel, Paird>((c) => c.p, chancmpidTest),
  };
  item.chans.insert(chan);
  hchans.insert(item);
  return {
    ncells: 0,
    ngcells: 0,
    cells: [],
    gcells: [],
    sg: {} as SGraph,
    hchans,
    vchans: newChanDict(),
  };
}

/** Local mirror of chancmpid for the fixture (containment == equal). */
function chancmpidTest(k1: Paird, k2: Paird): number {
  if (k1.p1 > k2.p1) return k1.p2 <= k2.p2 ? 0 : 1;
  if (k1.p1 < k2.p1) return k1.p2 >= k2.p2 ? 0 : -1;
  return 0;
}

describe("addPEdges — parallel-segment precedence edges", () => {
  it("adds a precedence edge between two segments tied by seg_cmp", () => {
    const chan = makeSharedChannel();
    const mp = makeMaze(chan);

    // Precondition: seg_cmp ties (identical p/l1/l2) so no edge exists yet.
    expect(edgeExists(chan.G!, 0, 1)).toBe(false);
    expect(edgeExists(chan.G!, 1, 0)).toBe(false);

    const rc = addPEdgesAll(mp.hchans, mp);
    expect(rc).toBe(0);

    // Postcondition: exactly one directed precedence edge now orders them.
    const forward = edgeExists(chan.G!, 0, 1);
    const backward = edgeExists(chan.G!, 1, 0);
    expect(forward !== backward).toBe(true); // exactly one direction set
  });

  it("is idempotent — running addPEdges twice does not add a conflicting edge", () => {
    const chan = makeSharedChannel();
    const mp = makeMaze(chan);
    addPEdgesAll(mp.hchans, mp);
    const firstForward = edgeExists(chan.G!, 0, 1);
    const firstBackward = edgeExists(chan.G!, 1, 0);

    // A second addPEdges pass over the same (now-tied-no-more) channel must
    // not flip or duplicate the edge — segList indices are unchanged so
    // edge_exists(G,0,1)||edge_exists(G,1,0) already short-circuits the
    // outer `!edge_exists(i,j) && !edge_exists(j,i)` guard in addPEdges.
    addPEdgesAll(mp.hchans, mp);
    expect(edgeExists(chan.G!, 0, 1)).toBe(firstForward);
    expect(edgeExists(chan.G!, 1, 0)).toBe(firstBackward);
  });
});
