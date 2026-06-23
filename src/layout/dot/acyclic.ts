// SPDX-License-Identifier: EPL-2.0
/** @see lib/dotgen/acyclic.c */
import type { Node } from '../../model/node.js';
import type { Graph } from '../../model/graph.js';
import { reverseEdge } from './fastgr.js';

interface DfsFrame { n: Node; i: number; }

/** Advance the top frame one step: descend a tree edge (push), reverse a back
 *  edge in place, or finish the node (clear onstack, pop). @see acyclic.c:dfs */
function dfsStep(stack: DfsFrame[]): void {
  const f = stack[stack.length - 1];
  const out = f.n.info.out;
  while (out && f.i < out.size) {
    const e = out.list[f.i];
    const w = e.head;
    if (w.info.onstack) {
      reverseEdge(e); // zapinlist swap-shrinks out; re-examine same slot
    } else if (!w.info.mark) {
      w.info.mark = 1;
      w.info.onstack = 1;
      f.i++; // advance past this tree edge before descending
      stack.push({ n: w, i: 0 });
      return; // descended
    } else {
      f.i++; // already visited, not on stack: skip
    }
  }
  f.n.info.onstack = 0;
  stack.pop();
}

/**
 * Iterative DFS back-edge reversal (AD-3). The recursive form (C acyclic.c:dfs)
 * descends to depth O(V) and overflows V8's small stack on deep chains; this
 * explicit-stack form is browser-safe and bit-identical (same visit order,
 * same `onstack` post-order, same in-place edge reversal).
 * @see lib/dotgen/acyclic.c:dfs
 */
function dfs(start: Node): void {
  if (start.info.mark) return;
  start.info.mark = 1;
  start.info.onstack = 1;
  const stack: DfsFrame[] = [{ n: start, i: 0 }];
  while (stack.length > 0) dfsStep(stack);
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
