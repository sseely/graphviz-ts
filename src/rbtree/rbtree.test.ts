// SPDX-License-Identifier: EPL-2.0
import { describe, it, expect } from 'vitest';
import {
  rbTreeCreate, rbTreeInsert, rbDelete, rbTreeDestroy,
  rbExactQuery, treeSuccessor, treePredecessor,
} from './index.js';

function numCmp(a: unknown, b: unknown): number {
  return (a as number) < (b as number) ? -1
    : (a as number) > (b as number) ? 1 : 0;
}

function noop(_key: unknown): void {}

describe('rbTreeCreate', () => {
  it('creates a tree with nil sentinel', () => {
    const t = rbTreeCreate(numCmp, noop);
    expect(t.nil).toBeDefined();
    expect(t.nil.red).toBe(0);
    expect(t.root.left).toBe(t.nil);
  });

  it('nil.red is always 0', () => {
    const t = rbTreeCreate(numCmp, noop);
    expect(t.nil.red).toBe(0);
  });
});

describe('rbTreeInsert and rbExactQuery', () => {
  it('inserts and finds a key', () => {
    const t = rbTreeCreate(numCmp, noop);
    const n = rbTreeInsert(t, 42);
    expect(n.key).toBe(42);
    expect(rbExactQuery(t, 42)).toBe(n);
  });

  it('rbExactQuery returns null for missing key', () => {
    const t = rbTreeCreate(numCmp, noop);
    rbTreeInsert(t, 5);
    expect(rbExactQuery(t, 99)).toBeNull();
    expect(rbExactQuery(t, 99)).not.toBe(t.nil);
  });

  it('root stays black after insertions', () => {
    const t = rbTreeCreate(numCmp, noop);
    for (let i = 0; i < 20; i++) rbTreeInsert(t, i);
    expect(t.root.left.red).toBe(0);
  });
});

describe('treeSuccessor sentinel contract', () => {
  it('treeSuccessor of max element returns tree.nil (not null)', () => {
    const t = rbTreeCreate(numCmp, noop);
    [1, 2, 3, 4, 5].forEach(v => rbTreeInsert(t, v));
    const maxNode = rbExactQuery(t, 5)!;
    const result = treeSuccessor(t, maxNode);
    expect(result).toBe(t.nil);
    expect(result).not.toBeNull();
  });

  it('treeSuccessor returns in-order successor', () => {
    const t = rbTreeCreate(numCmp, noop);
    [10, 20, 30].forEach(v => rbTreeInsert(t, v));
    const n10 = rbExactQuery(t, 10)!;
    const n20 = treeSuccessor(t, n10);
    expect(n20.key).toBe(20);
  });
});

describe('treePredecessor sentinel contract', () => {
  it('treePredecessor of min element returns tree.nil (not null)', () => {
    const t = rbTreeCreate(numCmp, noop);
    [1, 2, 3].forEach(v => rbTreeInsert(t, v));
    const minNode = rbExactQuery(t, 1)!;
    const result = treePredecessor(t, minNode);
    expect(result).toBe(t.nil);
    expect(result).not.toBeNull();
  });

  it('treePredecessor traversal visits all nodes descending', () => {
    const t = rbTreeCreate(numCmp, noop);
    [1, 2, 3, 4, 5].forEach(v => rbTreeInsert(t, v));
    const keys: number[] = [];
    let node = rbExactQuery(t, 5)!;
    keys.push(node.key as number);
    while (true) {
      node = treePredecessor(t, node);
      if (node === t.nil) break;
      keys.push(node.key as number);
    }
    expect(keys).toEqual([5, 4, 3, 2, 1]);
  });
});

describe('rbDelete', () => {
  it('removes a node so it is no longer found', () => {
    const t = rbTreeCreate(numCmp, noop);
    [1, 2, 3, 4, 5].forEach(v => rbTreeInsert(t, v));
    const n3 = rbExactQuery(t, 3)!;
    rbDelete(t, n3);
    expect(rbExactQuery(t, 3)).toBeNull();
  });

  it('tree stays sorted after delete', () => {
    const t = rbTreeCreate(numCmp, noop);
    for (let i = 1; i <= 10; i++) rbTreeInsert(t, i);
    rbDelete(t, rbExactQuery(t, 5)!);
    const keys: number[] = [];
    let node = rbExactQuery(t, 1)!;
    keys.push(node.key as number);
    while (true) {
      node = treeSuccessor(t, node);
      if (node === t.nil) break;
      keys.push(node.key as number);
    }
    expect(keys).toEqual([1, 2, 3, 4, 6, 7, 8, 9, 10]);
  });
});

describe('red-black invariants after heavy use', () => {
  it('nil.red stays 0 and real root stays black after 50 inserts + 25 deletes', () => {
    const t = rbTreeCreate(numCmp, noop);
    const nodes: ReturnType<typeof rbTreeInsert>[] = [];
    for (let i = 0; i < 50; i++) nodes.push(rbTreeInsert(t, i));
    // Delete every other node (25 deletes)
    for (let i = 0; i < 50; i += 2) rbDelete(t, nodes[i]);
    expect(t.nil.red).toBe(0);
    expect(t.root.left.red).toBe(0);
    // Walk from min to max, collect all keys
    const remaining: number[] = [];
    let cur = rbExactQuery(t, 1)!;
    remaining.push(cur.key as number);
    while (true) {
      cur = treeSuccessor(t, cur);
      if (cur === t.nil) break;
      remaining.push(cur.key as number);
    }
    expect(remaining).toEqual([1, 3, 5, 7, 9, 11, 13, 15, 17, 19,
      21, 23, 25, 27, 29, 31, 33, 35, 37, 39, 41, 43, 45, 47, 49]);
  });
});

describe('duplicate keys', () => {
  it('allows two nodes with the same key to coexist', () => {
    const t = rbTreeCreate(numCmp, noop);
    const n1 = rbTreeInsert(t, 10);
    const n2 = rbTreeInsert(t, 10);
    expect(n1).not.toBe(n2);
    // Full traversal should visit both
    let count = 0;
    let node = t.root.left;
    // Min-first traversal via finding leftmost then successor
    const findMin = (): ReturnType<typeof rbTreeInsert> => {
      let x = t.root.left;
      while (x.left !== t.nil) x = x.left;
      return x;
    };
    node = findMin();
    while (node !== t.nil) {
      count++;
      node = treeSuccessor(t, node);
    }
    expect(count).toBe(2);
  });
});

describe('rbTreeDestroy', () => {
  it('calls destroyKey on all nodes', () => {
    let destroyCount = 0;
    const t = rbTreeCreate(numCmp, () => { destroyCount++; });
    [1, 2, 3].forEach(v => rbTreeInsert(t, v));
    rbTreeDestroy(t);
    expect(destroyCount).toBe(3);
  });
});
