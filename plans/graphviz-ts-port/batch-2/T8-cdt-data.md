# T8 — CDT Data Structures

## Context

THIS IS THE HIGHEST-RISK CORRECTNESS DEPENDENCY IN THE ENTIRE PROJECT.

`lib/cdt` provides the dictionary (container data types) library used
throughout Graphviz. Its `DT_OSET` (ordered set, splay tree) variant is
used in `lib/dotgen/rank.c` for rank assignment. The iteration order of
`DT_OSET` — ascending key-comparison order via `dtfirst`/`dtnext` — directly
determines which nodes get which rank values. Wrong iteration order produces
wrong layout, which produces wrong SVG. There is no tolerance here.

The C splay tree (`dttree.c`) provides:
- `DT_OSET`: unique keys, splay tree, ascending comparator order, every
  operation splays the accessed node to root (read = structural mutation).
- `DT_SET`: unique keys, hash table (separate chaining), unspecified
  iteration order, initial 256 slots doubling when `size > 2 * ntab`.

The TypeScript port must NOT use JavaScript's built-in `Map` or `Set` for
`DtSplay` because they do not guarantee sorted iteration by a comparator.
The TypeScript port must NOT use `Map` or `Set` for `DtHash` either — use
a hash table with the exact `dtstrhash` algorithm so hash values match the
C reference.

Key behavioral contracts verified in the C source:

1. `DtSplay.first()` returns the minimum key (splays min to root).
2. `DtSplay.next(obj)` returns the in-order successor (splays successor to root).
3. Every `DtSplay` operation — including search and next — is a structural
   mutation (splay rotation). This is normal and intentional.
4. `DtSplay` enforces unique keys: inserting a duplicate returns the existing
   object without adding a new node.
5. `DtHash.first()` scans slots from index 0 upward; order is hash-slot order,
   not comparison order.
6. `DtHash` resize is deferred while a walk is in progress (`loop > 0`).
   `first()` increments `loop`; `next()` returning `undefined` decrements it.
   An incomplete walk permanently suppresses resize.
7. `dtstrhash` for null-terminated strings advances 2 bytes per step unless
   the second byte is `\0` — this is the exact loop from `dtstrhash.c` and
   must be replicated conformant.

## Task

Port `lib/cdt/` to TypeScript. Implement two container classes:

### DtSplay (src/cdt/splay.ts)

A top-down splay tree implementing `DT_OSET` semantics. The comparator is
passed at construction time (mirrors `Dtdisc_t.comparf`).

Required operations (naming mirrors the C macros):
- `insert(obj: T): T` — insert object; return existing if key duplicate
- `delete(obj: T): boolean` — remove object; return false if not found
- `search(key: K): T | undefined` — find by key
- `first(): T | undefined` — minimum element (dtfirst)
- `next(obj: T): T | undefined` — in-order successor (dtnext)
- `last(): T | undefined` — maximum element (dtlast)
- `prev(obj: T): T | undefined` — in-order predecessor (dtprev)
- `size(): number`
- `clear(): void`

The splay implementation must use the top-down algorithm matching `dttree.c`.
Read `dttree.c` carefully: the LEFT and RIGHT partition variables use an
inverted naming convention (`link.right` holds the LEFT partition,
`link.left` holds the RIGHT partition). This is intentional in the C source
and must be preserved if it affects observable behavior. Observable behavior
that must match: `first()` returns the globally minimum key; `next(obj)`
returns the globally next key after `obj` in comparator order.

### DtHash (src/cdt/hash.ts)

A separate-chaining hash table implementing `DT_SET` semantics.

Required operations:
- `insert(obj: T): T`
- `delete(obj: T): boolean`
- `search(key: K): T | undefined`
- `first(): T | undefined`
- `next(obj: T): T | undefined`
- `size(): number`
- `clear(): void`

Internal state:
- Initial slot count: 256 (`HSLOT`)
- Resize when `size > 2 * ntab` (but not while `loop > 0`)
- Hash function: port `dtstrhash` from `dtstrhash.c` exactly. For string
  keys (`n <= 0` mode): advance 2 bytes per step unless the second byte is
  `\0`. Multiplier: `17109811`. Add string length at end.
- Move-to-front heuristic on search when `loop === 0`; suppressed during walk.

### Index and exports (src/cdt/index.ts)

Export `DtSplay`, `DtHash`, and the `Comparator<T>` / `KeyOf<T, K>` type
helpers used to construct them.

## Write-Set

- `src/cdt/splay.ts`
- `src/cdt/hash.ts`
- `src/cdt/index.ts`

## Read-Set

- `~/git/graphviz/lib/cdt/cdt.h` — public API and data structure definitions
- `~/git/graphviz/lib/cdt/dttree.c` — splay tree implementation;
  pay particular attention to `dtfirst`, `dtnext`, and the LEFT/RIGHT
  partition variable naming in the top-down splay
- `~/git/graphviz/lib/cdt/dthash.c` — hash table implementation
- `~/git/graphviz/lib/cdt/dtstrhash.c` — hash function; the 2-byte stepping
  loop for string keys is non-standard and must be replicated exactly
- `~/git/graphviz/lib/cdt/dthdr.h` — internal macros (HSLOT, HRESIZE,
  HLOAD, HINDEX, rrotate, lrotate)
- `~/git/graphviz/docs/architecture/lib/cdt.md` — full behavioral analysis
  including the "Iteration Order Summary" table

## Architecture Decisions

- Do NOT use JavaScript `Map` or `Set` for either container type. They do not
  provide the required iteration semantics.
- `DtSplay` must guarantee ascending comparator-order iteration.
- `dtstrhash` must be ported verbatim (2-byte stepping loop, multiplier
  `17109811`, length addend).

## Interface Contracts

```typescript
// src/cdt/index.ts
export type Comparator<K> = (a: K, b: K) => number;  // <0, 0, >0
export type KeyOf<T, K> = (obj: T) => K;

export class DtSplay<T, K = T> {
  constructor(keyOf: KeyOf<T, K>, compare: Comparator<K>);
  insert(obj: T): T;
  delete(obj: T): boolean;
  search(key: K): T | undefined;
  first(): T | undefined;
  next(obj: T): T | undefined;
  last(): T | undefined;
  prev(obj: T): T | undefined;
  size(): number;
  clear(): void;
  [Symbol.iterator](): Iterator<T>;  // ascending order
}

export class DtHash<T, K = T> {
  constructor(keyOf: KeyOf<T, K>, hash: (key: K) => number,
              compare: Comparator<K>);
  insert(obj: T): T;
  delete(obj: T): boolean;
  search(key: K): T | undefined;
  first(): T | undefined;
  next(obj: T): T | undefined;
  size(): number;
  clear(): void;
}

export function dtStrHash(s: string): number;  // dtstrhash port
```

## Acceptance Criteria

**Given** 100 keys inserted into a `DtSplay` in random order,  
**When** iterated via `first()` / `next()` until `undefined`,  
**Then** keys are visited in strictly ascending comparator order with no
key skipped or repeated.

**Given** the same 100 keys inserted into `DtHash`,  
**When** iterated via `first()` / `next()` until `undefined`,  
**Then** all 100 keys are returned (order is unspecified, but none missing).

**Given** a `DtSplay` with 10 keys, after deleting key 5 and reinserting it,  
**When** iterated via `first()` / `next()`,  
**Then** all 10 keys appear in ascending order (sort invariant maintained
across delete + reinsert).

## Observability

N/A — pure data structure; no async paths, no I/O.

## Rollback

Reversible. New files only. Revert by removing `src/cdt/`.

## Quality Bar

- `tsc --noEmit` exits 0
- T9 (cdt-order.test.ts) passes once written — T8 must not merge until T9
  is also passing
- One commit: `feat(cdt): port lib/cdt DtSplay and DtHash`
