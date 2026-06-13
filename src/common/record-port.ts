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
import type { Port } from '../model/geom.js';
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
