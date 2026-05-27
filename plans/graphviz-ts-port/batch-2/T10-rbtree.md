# T10 — Red-Black Tree with Nil Sentinel

## Context

`lib/rbtree` is a self-contained red-black balanced BST (Emin Martinian,
with modifications for Graphviz). It is used only by `lib/neatogen/overlap.c`
for sweep-line overlap detection during layout: the active-interval set is
ordered by Y-coordinate scan-point values, and `TreePredecessor` is called
in a while-loop to walk backward through Y-neighbors of a departing interval.

The library has two sentinel nodes allocated at tree creation:

- **`tree.nil`**: represents every leaf (NULL) in the tree. All leaf pointers
  point to `nil`, never to `null` or `undefined`. `nil.red` is always `0`
  (black). Its `parent`, `left`, `right` fields may be transiently modified
  during rotations — this is documented in the C source and is intentional.
- **`tree.root`**: a dummy root sentinel whose `.left` child is the actual
  BST root. Eliminates special-case checks for the real root in insert,
  delete, and rotation.

**The nil-sentinel contract is non-negotiable.** `TreeSuccessor` and
`TreePredecessor` return `tree.nil` (not `null`, not `undefined`) when there
is no successor/predecessor. `RBExactQuery` returns `null` (not `tree.nil`)
when the key is not found. Any code that traverses via `TreePredecessor` must
test `result !== tree.nil` to detect end-of-sequence. `neatogen/overlap.c`
uses this pattern:
```c
while ((node = TreePredecessor(tree, node)) != tree->nil) { ... }
```
The TypeScript port must expose the same sentinel identity semantics.

Additional behavioral subtleties:
- Duplicate keys are permitted. `TreeInsertHelp` routes equal keys to the
  right subtree (`Compare(x.key, z.key) === 1` routes left; equal or
  greater routes right).
- `RBDelete` uses the successor-splice strategy for nodes with two non-nil
  children. It calls `DestroyKey` on the logical node's key, not the splice
  node's key.
- `LeftRotate` and `RightRotate` explicitly guard against overwriting the
  nil sentinel's parent pointer. Replicating this guard is required to
  avoid `RBDeleteFixUp` reading a corrupted `nil.parent`.

## Task

Port `lib/rbtree/` to TypeScript as a single module at `src/rbtree/index.ts`.

The public API mirrors the C API exactly (camelCase names):

```typescript
rbTreeCreate(compare, destroyKey) → RbTree
rbTreeInsert(tree, key) → RbNode
rbDelete(tree, node) → void
rbTreeDestroy(tree) → void
rbExactQuery(tree, key) → RbNode | null   // null, NOT tree.nil
treeSuccessor(tree, node) → RbNode        // returns tree.nil at max
treePredecessor(tree, node) → RbNode      // returns tree.nil at min
```

`RbNode` must expose:
- `key: unknown` (opaque, caller-owned)
- `red: number` (0 or 1)
- `left: RbNode`, `right: RbNode`, `parent: RbNode`

`RbTree` must expose:
- `nil: RbNode` — the sentinel; callers test against this for end-of-sequence
- `root: RbNode` — dummy root sentinel; real root is `root.left`
- `compare: (a: unknown, b: unknown) => number`
- `destroyKey: (key: unknown) => void`

Do not add a `[Symbol.iterator]` or any traversal sugar. The only traversal
mechanism is chaining `treeSuccessor` / `treePredecessor` calls from a node
obtained via `rbExactQuery`. This matches the C API exactly.

Write tests in `src/rbtree/rbtree.test.ts` covering:
- Basic insert, search, delete
- Sentinel identity: `treeSuccessor` of max element returns the exact object
  `tree.nil` (i.e., `result === tree.nil` is true)
- Sentinel identity: `treePredecessor` of min element returns `tree.nil`
- `rbExactQuery` returns `null` (not `tree.nil`) for missing key
- Red-black invariant spot-check after 50 random inserts and 25 deletes:
  (a) `nil.red === 0`; (b) real root `tree.root.left.red === 0`;
  (c) walk from min to max via `treeSuccessor` visits all remaining nodes
- Duplicate key behavior: two nodes with the same key can coexist; both
  are returned during a full traversal

## Write-Set

- `src/rbtree/index.ts`
- `src/rbtree/rbtree.test.ts`

## Read-Set

- `~/git/graphviz/lib/rbtree/red_black_tree.h` — struct definitions and
  public API declarations
- `~/git/graphviz/lib/rbtree/red_black_tree.c` — full implementation;
  read `LeftRotate` and `RightRotate` for the nil-sentinel parent-pointer
  guard; read `RBDelete` for the successor-splice and `DestroyKey` call
  semantics
- `~/git/graphviz/docs/architecture/lib/rbtree.md` — behavioral analysis
  (non-obvious subtleties, return-value conventions)

## Architecture Decisions

- `tree.nil` must be a singleton object. All leaf pointers in the tree
  point to this exact object. `treeSuccessor` and `treePredecessor` return
  this exact object at end-of-sequence — callers use `=== tree.nil` to
  detect the boundary.
- `rbExactQuery` returns `null` (not `tree.nil`) for a missing key. These
  are different values and different tests; do not conflate them.

## Interface Contracts

```typescript
// src/rbtree/index.ts

export interface RbNode {
  key: unknown;
  red: number;         // 0 = black, 1 = red
  left: RbNode;
  right: RbNode;
  parent: RbNode;
}

export interface RbTree {
  nil: RbNode;          // leaf sentinel — test against this for end-of-seq
  root: RbNode;         // dummy root; real root is root.left
  compare: (a: unknown, b: unknown) => number;
  destroyKey: (key: unknown) => void;
}

export function rbTreeCreate(
  compare: (a: unknown, b: unknown) => number,
  destroyKey: (key: unknown) => void,
): RbTree;

export function rbTreeInsert(tree: RbTree, key: unknown): RbNode;
export function rbDelete(tree: RbTree, node: RbNode): void;
export function rbTreeDestroy(tree: RbTree): void;
export function rbExactQuery(tree: RbTree, key: unknown): RbNode | null;
export function treeSuccessor(tree: RbTree, x: RbNode): RbNode;
export function treePredecessor(tree: RbTree, x: RbNode): RbNode;
```

## Acceptance Criteria

**Given** a tree with keys `[1, 2, 3, 4, 5]` and 5 inserted as the maximum,  
**When** `treeSuccessor(tree, nodeWith5)` is called,  
**Then** the result is `=== tree.nil` (not `null`, not `undefined`).

**Given** a freshly created tree with one insert,  
**When** `treePredecessor(tree, minNode)` is called,  
**Then** the result is `=== tree.nil`.

**Given** `rbExactQuery(tree, missingKey)`,  
**When** the key does not exist in the tree,  
**Then** the result is `null` (not `tree.nil`).

**Given** 50 nodes inserted then 25 deleted,  
**When** the `nil` sentinel is inspected,  
**Then** `tree.nil.red === 0` and `tree.root.left.red === 0`.

## Observability

N/A — pure data structure; no I/O.

## Rollback

Reversible. New files only. Revert by removing `src/rbtree/`.

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run src/rbtree/rbtree.test.ts` exits 0
- One commit: `feat(rbtree): port lib/rbtree with nil-sentinel contract`
