// SPDX-License-Identifier: EPL-2.0
/** @see lib/dotgen/acyclic.c */
import type { Node } from '../../model/node.js';
import type { Graph } from '../../model/graph.js';
import { reverseEdge } from './fastgr.js';

function dfs(n: Node): void {
  if (n.info.mark) return;
  n.info.mark = 1;
  n.info.onstack = 1;
  const out = n.info.out;
  if (out) {
    for (let i = 0; i < out.size; i++) {
      const w = out.list[i].head;
      if (w.info.onstack) {
        reverseEdge(out.list[i]);
        i--; // zapinlist swap-shrinks out; re-examine same slot
      } else if (!w.info.mark) {
        dfs(w);
      }
    }
  }
  n.info.onstack = 0;
}

/**
 * Break cycles in the fast graph by reversing DFS back edges.
 * Reversed edges carry `EdgeInfo.reversed = true`.
 * @see lib/dotgen/acyclic.c:acyclic
 */
export function acyclic(g: Graph): void {
  const comp = g.info.comp ?? [];
  for (let c = 0; c < comp.length; c++) {
    g.info.nlist = comp[c];
    for (let n: Node | undefined = comp[c]; n !== undefined; n = n.info.next) n.info.mark = 0;
    for (let n: Node | undefined = comp[c]; n !== undefined; n = n.info.next) dfs(n);
  }
}
