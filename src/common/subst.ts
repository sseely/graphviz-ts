// SPDX-License-Identifier: EPL-2.0

/**
 * Graph-object escape substitution: \G \N \E \T \H \L resolved against
 * a node, edge, or graph. Used by plain-label creation (escBackslash
 * false — \\ left for the formatting pass) and by anchor/map data
 * (escBackslash true — \\ collapses to \).
 *
 * @see lib/common/labels.c:strdup_and_subst_obj0
 * @see lib/common/labels.c:strdup_and_subst_obj
 */

import { Node } from '../model/node.js';
import { Edge } from '../model/edge.js';
import { Graph } from '../model/graph.js';
import type { TextlabelT } from './types.js';

export type GraphObj = Node | Edge | Graph;

/** Resolved values per escape letter. @see strdup_and_subst_obj0 (switch) */
type SubstTable = Record<'G' | 'N' | 'E' | 'T' | 'H' | 'L', string>;

function labelTextOf(info: { label?: unknown }): string | null {
  const lp = info.label as TextlabelT | undefined;
  return lp !== undefined ? lp.text : null;
}

/** Unresolvable escapes stay literal (C keeps the initial "\X" strings). */
const LITERAL: SubstTable = {
  G: '\\G', N: '\\N', E: '', T: '\\T', H: '\\H', L: '\\L',
};

function nodeTable(n: Node): SubstTable {
  return {
    ...LITERAL,
    G: n.root.name,
    N: n.name,
    L: labelTextOf(n.info) ?? LITERAL.L,
  };
}

/** \E expansion: tail[:tp](->|--)head[:hp]. @see strdup_and_subst_obj0 (case 'E') */
function expandE(e: Edge): string {
  // Ports are stored on edge info when present. @see ED_tail_port
  const ti = e.info as { tail_port?: { name?: string }; head_port?: { name?: string } };
  const tp = ti.tail_port?.name ?? '';
  const hp = ti.head_port?.name ?? '';
  const sep = e.tail.root.kind === 'directed' ? '->' : '--';
  return e.tail.name + (tp !== '' ? ':' + tp : '')
    + sep + e.head.name + (hp !== '' ? ':' + hp : '');
}

function edgeTable(e: Edge): SubstTable {
  return {
    G: e.tail.root.name,
    N: LITERAL.N,
    E: expandE(e),
    T: e.tail.name,
    H: e.head.name,
    L: labelTextOf(e.info) ?? LITERAL.L,
  };
}

function graphTable(g: Graph): SubstTable {
  return { ...LITERAL, G: g.name, L: labelTextOf(g.info) ?? LITERAL.L };
}

function substTable(obj: GraphObj): SubstTable {
  if (obj instanceof Node) return nodeTable(obj);
  if (obj instanceof Edge) return edgeTable(obj);
  return graphTable(obj);
}

const isSubstEscape = (e: string): e is keyof SubstTable =>
  e === 'G' || e === 'N' || e === 'E' || e === 'T' || e === 'H' || e === 'L';

/**
 * Resolve graph-object escapes in str. Other escape sequences
 * (\n, \l, \r, …) pass through unmodified; \\ collapses to \ only
 * when escBackslash is set, mirroring C exactly.
 * @see lib/common/labels.c:strdup_and_subst_obj0 (assembly loop)
 */
export function substObj(str: string, obj: GraphObj, escBackslash: boolean): string {
  if (!str.includes('\\')) return str;
  const table = substTable(obj);
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const c = str[i]!;
    if (c !== '\\' || i + 1 >= str.length) { out += c; continue; }
    const e = str[++i]!;
    if (isSubstEscape(e)) out += table[e];
    else if (e === '\\' && escBackslash) out += '\\';
    else out += '\\' + e;
  }
  return out;
}

/** The escBackslash=true form used for anchor/map data. @see strdup_and_subst_obj */
export function substObjAnchor(str: string, obj: GraphObj): string {
  return substObj(str, obj, true);
}

/**
 * Tooltip newline mapping: \n and \l become newline, \r carriage
 * return, and the backslash is dropped from any other escape. C runs
 * this BEFORE object substitution (preprocessTooltip), which is why
 * \N in a tooltip renders as a literal "N".
 * @see lib/common/emit.c:interpretCRNL
 */
export function interpretCRNL(str: string): string {
  let out = '';
  let backslash = false;
  for (const c of str) {
    if (backslash) {
      if (c === 'n' || c === 'l') out += '\n';
      else if (c === 'r') out += '\r';
      else out += c;
      backslash = false;
    } else if (c === '\\') {
      backslash = true;
    } else {
      out += c;
    }
  }
  return out;
}
