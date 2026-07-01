// SPDX-License-Identifier: EPL-2.0

/**
 * Record-shape edge ports: resolve a `field:compass` port string to a point on
 * the named field's bounding box (falling back to a compass on the whole
 * record bbox when the name is not a field id).
 *
 * @see lib/common/shapes.c:map_rec_port (line 3716)
 * @see lib/common/shapes.c:record_port (line 3732)
 */

import type { Node } from '../model/node.js';
import type { Box, Port } from '../model/geom.js';
import type { FieldT } from './types.js';
import { makePort } from '../model/edgeInfo.js';
import { compassPort } from './compass-port.js';
import { BOTTOM, RIGHT, TOP, LEFT } from './splines-constants.js';

const ALL_SIDES = BOTTOM | RIGHT | TOP | LEFT;

/**
 * Recurse the field tree for a field whose id equals str (depth-first).
 * @see lib/common/shapes.c:map_rec_port
 */
export function mapRecPort(f: FieldT, str: string): FieldT | null {
  if (f.id !== null && f.id === str) return f;
  if (f.fld !== null) {
    for (let i = 0; i < f.n_flds; i++) {
      const rv = mapRecPort(f.fld[i]!, str);
      if (rv !== null) return rv;
    }
  }
  return null;
}

/**
 * portfn for record shapes. Empty portname → Center (makePort, byte-stable).
 * A matching field → compass on the field bbox; otherwise the portname is
 * treated as a compass on the whole record bbox.
 * @see lib/common/shapes.c:record_port
 */
export function recordPort(n: Node, portname: string, compass: string): Port {
  if (portname.length === 0) return makePort(); // C: return Center
  const compassStr = compass.length === 0 ? '_' : compass; // C: NULL → "_"
  const f = n.info.shape_info as FieldT | undefined;
  const rv = makePort();
  if (f === undefined) return rv;
  const subf = mapRecPort(f, portname);
  if (subf !== null) {
    compassPort(n, { bp: subf.b, compass: compassStr, sides: subf.sides }, rv);
  } else {
    compassPort(n, { bp: f.b, compass: portname, sides: ALL_SIDES }, rv);
  }
  return rv;
}

/**
 * pboxfn for record shapes: "generate box path from port to border". Emit ONE
 * box — the full-node-height vertical strip of the TOP-LEVEL field whose axis
 * range brackets the port point `prt.p.x` — into `rv[0]`, set `kptr[0]=1`, and
 * return `side`. Returns 0 when the port is undefined. Without this, a record
 * head/tail port with no explicit side (interior cell, side==0) falls back to
 * the node's maximal bbox and the spline cuts straight across instead of
 * hugging the port column. @see lib/common/shapes.c:record_path (line 3793)
 */
export function recordPath(n: Node, prt: Port, side: number, rv: Box[], kptr: number[]): number {
  if (!prt.defined) return 0;
  const info = n.info.shape_info as FieldT | undefined;
  if (info === undefined || info.fld === null) return side;
  const flip = n.root.info.flip === true; // GD_flip
  const cx = n.info.coord.x;
  const cy = n.info.coord.y;
  const ht2 = n.info.ht / 2;
  for (let i = 0; i < info.n_flds; i++) {
    const fb = info.fld[i]!.b;
    // C: axis is x for TB/BT, y for LR/RL (GD_flip).
    const ls = flip ? fb.ll.y : fb.ll.x;
    const rs = flip ? fb.ur.y : fb.ur.x;
    if (ls <= prt.p.x && prt.p.x <= rs) {
      // C sets LL.x/LL.y/UR.x in-branch, then UR.y = coord.y + ht/2 for both.
      rv[0] = flip
        ? { ll: { x: fb.ll.y + cx, y: fb.ll.x + cy }, ur: { x: fb.ur.y + cx, y: cy + ht2 } }
        : { ll: { x: cx + ls, y: cy - ht2 }, ur: { x: cx + rs, y: cy + ht2 } };
      kptr[0] = 1;
      break;
    }
  }
  return side;
}
