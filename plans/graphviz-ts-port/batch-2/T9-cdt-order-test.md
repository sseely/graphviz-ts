# T9 — CDT DT_OSET Iteration Order Verification

## Context

The correctness of every `dot` layout produced by the TypeScript port depends
on `DtSplay` iteration producing keys in the same ascending comparator order
as C `dtfirst`/`dtnext`. This task writes exhaustive tests that confirm that
contract. It is a standalone task so that CDT order correctness is explicitly
verified and tracked as a quality gate separate from the implementation task.

T9 depends on T8 completing first. The tests import `DtSplay` from
`src/cdt/splay.ts` and exercise it in isolation.

Reference behavior is established by reading `lib/cdt/dttree.c` directly —
specifically the `DT_FIRST`, `DT_LAST`, `DT_NEXT`, and `DT_PREV` branches in
the `dttree` dispatch function. The C code for `DT_FIRST`:
1. Traverses `root->left` links while applying `RROTATE` until no left child
   exists, effectively splaying the minimum to root.
2. Sets `data.here = root` and returns the root object.

`DT_NEXT` for object `obj`:
1. Splays `obj` to root.
2. Finds the minimum of the right subtree (successor in comparison order).
3. Splays that minimum to root.
4. Returns it, or NULL if no right subtree.

The tests must confirm this behavior independently of the implementation
details by treating `DtSplay` as a black box and checking observable output.

## Task

Write `src/cdt/cdt-order.test.ts` containing the following test cases:

### Test 1: 100-key random insertion, integer comparator

Insert integers 0..99 in a shuffled order into `DtSplay`. Iterate via
`first()` / `next()` and collect the sequence. Assert the sequence equals
`[0, 1, 2, ..., 99]`.

Use a fixed shuffle seed (seeded MT19937 from T7, seed = 42) so the test
is deterministic and the insertion order is non-trivial.

### Test 2: Delete-and-reinsert maintains sort order

Start with integers 0..19 inserted in reverse order. Delete keys 5, 10, 15.
Reinsert them. Iterate and assert the full sequence `[0..19]` is produced
in order.

### Test 3: Reverse iteration via prev()

Insert integers 0..19. Call `last()` then `prev()` repeatedly. Assert the
sequence is `[19, 18, ..., 0]`.

### Test 4: String comparator matches C strcmp ordering

Insert the strings `["banana", "apple", "cherry", "date", "apricot"]`.
Iterate forward. Assert the order matches JavaScript's `localeCompare`
with the `"en"` locale and `sensitivity: "variant"` (equivalent to C
`strcmp` for ASCII strings). Expected: `["apple", "apricot", "banana",
"cherry", "date"]`.

### Test 5: Duplicate key insert returns existing object

Create two objects `{ id: 1, name: "first" }` and `{ id: 1, name: "second" }`
with the same key `1`. Insert first, then insert second. Assert that `insert`
returns the first object (existing), not the second, and that `size()` is 1.

### Test 6: walk abandonment does not corrupt future walks

Insert 10 items. Call `first()`, then `next()` once (incomplete walk). Call
`first()` again and iterate to completion. Assert all 10 items are returned
in sorted order on the second walk. (Splay trees have no loop counter — this
test verifies there is no DtHash-style loop-counter corruption in DtSplay.)

### Test 7: DtHash — all keys returned by full walk

Insert 200 random integers into `DtHash`. Walk to completion via
`first()` / `next()`. Assert all 200 keys are returned.

### Test 8: DtHash — incomplete walk followed by insert

Insert 50 integers into `DtHash`. Start a walk (call `first()`, advance 5
times). Call `insert(9999)`. Walk again from `first()` to completion. Assert
all 51 keys are returned in the second walk. (Verifies that deferred resize
does not lose elements.)

## Write-Set

- `src/cdt/cdt-order.test.ts`

## Read-Set

- `~/git/graphviz/lib/cdt/dttree.c` — dtfirst, dtnext, dtlast, dtprev
  implementations (the C reference whose behavior the tests verify)
- `src/cdt/splay.ts` — the implementation under test (T8 output)
- `src/cdt/hash.ts` — the hash implementation under test (T8 output)

## Architecture Decisions

None beyond what T8 established. This task only writes tests.

## Interface Contracts

Imports from `src/cdt/index.ts` (T8 output). Uses `rkSeed`/`rkRandom` from
`src/util/mt19937.ts` (T7 output) for deterministic shuffle in Test 1.

## Acceptance Criteria

**Given** 100 integers inserted in a shuffled order into `DtSplay`,  
**When** iterated via `first()` / `next()` until `undefined`,  
**Then** the sequence is exactly `[0, 1, 2, ..., 99]` in ascending order.

**Given** a `DtSplay` with items deleted and reinserted,  
**When** iterated from `first()` to `undefined`,  
**Then** the full sorted sequence is produced with no gaps and no
duplicates.

**Given** `last()` called on a 20-element `DtSplay` followed by `prev()`,  
**When** iterated until `undefined`,  
**Then** the sequence is `[19, 18, ..., 0]` (descending, exactly 20 items).

## Observability

N/A — test-only file; no runtime behavior.

## Rollback

Reversible. Adds only a test file. Revert by removing
`src/cdt/cdt-order.test.ts`.

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run src/cdt/cdt-order.test.ts` exits 0, all 8 test cases pass
- One commit: `test(cdt): exhaustive DT_OSET iteration order verification`
