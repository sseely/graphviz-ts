# T11 — VPSC Constraint Solver

## Context

`lib/vpsc` implements Variable Placement with Separation Constraints (VPSC),
a constrained quadratic programming solver for node overlap removal. The
algorithm is from Dwyer, Marriott, and Stuckey, "Fast node overlap removal,"
GD 2005 (LNCS 3843, pp. 153–164).

The solver minimizes `Σ w_i (x_i - d_i)²` subject to separation constraints
of the form `right.position - left.position >= gap`. It operates on one axis
at a time. Callers invoke it twice — once for X, once for Y — with completely
independent `Variable[]` and `Constraint[]` arrays each time. There is no
shared state between the X and Y passes.

**Architecture decision AD-4** governs this task:
- TypeScript class (not a C++ wrapper)
- Two-pass usage: X axis, then Y axis, with independent instances
- Teardown order: `deleteVPSC → deleteConstraints → deleteVariable`
- Convergence threshold for `IncVPSC.solve()`: `|Δcost| ≤ 0.0001`

Key implementation details from the C++ source:

**Block/Variable model:** Each `Variable` starts in its own `Block`. Blocks
are merged as constraints are satisfied. The `Block` maintains `posn` (the
block's reference position) and `wposn` (weighted position sum). A variable's
actual position is `block.posn + variable.offset`.

**IncVPSC.solve() convergence loop:**
```
lastCost = Infinity
loop:
  satisfy()       // splitBlocks + merge inactive violated constraints
  splitBlocks()   // moveBlocks + split negative-LM constraints
  cost = sum of block costs
  if |lastCost - cost| <= 0.0001: break
  lastCost = cost
```
The threshold `0.0001` is hardcoded. It is absolute, not relative.

**Feasibility check epsilon:** `slack < -0.0000001` (1e-7) is the threshold
for "violated". Constraints with slack in `(-1e-7, 0]` are treated as
satisfied.

**Within-block cycle guard:** If a violated constraint exists within a single
block, `IncVPSC.satisfy()` attempts split-and-remerge. If this cycle repeats
more than 10,000 times, throw `Error("Cycle Error!")`.

**`satisfyVPSC` exception handling bug in the C bridge:** The C bridge
`satisfyVPSC` only catches `const char*` exceptions, not `std::runtime_error`.
The TypeScript port does not have this bug — catch all `Error` types at the
boundary.

**Teardown order is load-bearing:** `deleteVPSC` deletes `Blocks` which
deletes `Block` objects but NOT variables or constraints. Constraints must be
deleted separately (`deleteConstraints`) before variables, because
`Constraint` holds pointers to `Variable`. Deleting a variable before its
constraints leaves dangling references. Document this in JSDoc on the
teardown functions.

**`blockTimeCtr`** is a global monotonic timestamp in the C source that gates
stale constraint heap entries. In the TypeScript port, use a closure variable
inside the `Blocks` class (not a module-level global) — this eliminates the
thread-safety issue in the C original and is the correct scoping.

## Task

Port `lib/vpsc/` to TypeScript as four files:

### Variable (src/vpsc/Variable.ts)

```typescript
export class Variable {
  id: number;
  desiredPosition: number;
  weight: number;
  offset: number;
  block: Block | null;
  visited: boolean;
  in: Constraint[];    // constraints where this is the right endpoint
  out: Constraint[];   // constraints where this is the left endpoint
  constructor(id: number, desiredPos: number, weight: number);
  position(): number;  // block.posn + offset
}
```

### Constraint (src/vpsc/Constraint.ts)

```typescript
export class Constraint {
  left: Variable;
  right: Variable;
  gap: number;
  lm: number;         // Lagrange multiplier; undefined until compute_dfdv runs
  timeStamp: number;
  active: boolean;
  visited: boolean;
  constructor(left: Variable, right: Variable, gap: number);
  // Constructor registers itself in both left.out and right.in
  slack(): number;    // right.position() - gap - left.position()
  destroy(): void;    // removes from left.out and right.in; call before GC
}
```

Note: In TypeScript there is no destructor. Provide an explicit `destroy()`
method that removes the constraint from both variables' `in`/`out` arrays.
The `deleteConstraint`/`deleteConstraints` functions in `src/vpsc/index.ts`
must call `destroy()`.

### Solver (src/vpsc/Solver.ts)

Implement the `Block`, `Blocks`, `VPSC`, and `IncVPSC` classes from
`solve_VPSC.cpp`, `block.cpp`, and `blocks.cpp`. The `blockTimeCtr` counter
must be a private field on `Blocks` instances, not a module-level global.

`VPSC.satisfy()` — Phase 1 (feasibility): topological sort, mergeLeft per
variable, cleanup, verify (throw if any `slack < -1e-7`).

`VPSC.refine()` — Phase 2 (optimality): split on negative-LM constraints,
restart until stable.

`VPSC.solve()` — calls `satisfy()` then `refine()`.

`IncVPSC.solve()` — convergence loop: `satisfy()`/`splitBlocks()` until
`|Δcost| ≤ 0.0001`.

`IncVPSC.satisfy()` — `splitBlocks()` first, then merge on most-violated
inactive constraint. Within-block violation: split-between then remerge;
throw `Error("Cycle Error!")` if count exceeds 10,000.

### Index and C-bridge functions (src/vpsc/index.ts)

Port the `csolve_VPSC.h` C bridge as TypeScript functions:

```typescript
export function newVariable(id: number, desiredPos: number, weight: number): Variable;
export function deleteVariable(v: Variable): void;
export function setVariableDesiredPos(v: Variable, pos: number): void;
export function getVariablePos(v: Variable): number;
export function newConstraint(left: Variable, right: Variable, gap: number): Constraint;
export function deleteConstraint(c: Constraint): void;
export function deleteConstraints(cs: Constraint[]): void;
export function newIncVPSC(vs: Variable[], cs: Constraint[]): IncVPSC;
export function deleteVPSC(vpsc: VPSC): void;  // no-op in TS; documents teardown order
export function satisfyVPSC(vpsc: VPSC): void;
export function solveVPSC(vpsc: VPSC): void;
export function genXConstraints(
  rects: Rectangle[], vs: Variable[],
  useNeighbourLists: boolean
): Constraint[];
export function genYConstraints(rects: Rectangle[], vs: Variable[]): Constraint[];
```

Also port `Rectangle` and `generateXConstraints`/`generateYConstraints` from
`generate-constraints.cpp`.

**Teardown order documentation** (JSDoc on `deleteVPSC`):
```
/** Call in order: deleteVPSC → deleteConstraints → deleteVariable.
 *  deleteVPSC releases block structures. Constraints still reference
 *  Variables; delete constraints before variables to avoid dangling refs.
 */
```

## Write-Set

- `src/vpsc/Variable.ts`
- `src/vpsc/Constraint.ts`
- `src/vpsc/Solver.ts`
- `src/vpsc/index.ts`
- `src/vpsc/vpsc.test.ts`

## Read-Set

- `~/git/graphviz/lib/vpsc/variable.h` and `variable.cpp`
- `~/git/graphviz/lib/vpsc/constraint.h` and `constraint.cpp`
- `~/git/graphviz/lib/vpsc/block.h` and `block.cpp`
- `~/git/graphviz/lib/vpsc/blocks.h` and `blocks.cpp`
- `~/git/graphviz/lib/vpsc/solve_VPSC.h` and `solve_VPSC.cpp`
- `~/git/graphviz/lib/vpsc/csolve_VPSC.h` and `csolve_VPSC.cpp`
- `~/git/graphviz/lib/vpsc/generate-constraints.h` and
  `generate-constraints.cpp`
- `~/git/graphviz/docs/architecture/lib/vpsc.md` — complete behavioral
  analysis including convergence behavior, infeasibility handling, and
  numerical precision notes

## Architecture Decisions

- **AD-4**: TypeScript class, two-pass (X then Y), independent instances,
  teardown order `deleteVPSC → deleteConstraints → deleteVariable`,
  convergence threshold `|Δcost| ≤ 0.0001`.
- `blockTimeCtr` is a private `Blocks` instance field, not a module global.
- `Constraint.destroy()` replaces the C++ destructor for unregistering from
  variable `in`/`out` lists.

## Interface Contracts

See the four TypeScript classes/interfaces described in the Task section
above. The key exported surface is `src/vpsc/index.ts`.

```typescript
// Minimum types needed by callers
export { Variable } from './Variable';
export { Constraint } from './Constraint';
export { VPSC, IncVPSC } from './Solver';
export { Rectangle } from './Solver';
export {
  newVariable, deleteVariable, setVariableDesiredPos, getVariablePos,
  newConstraint, deleteConstraint, deleteConstraints,
  newIncVPSC, deleteVPSC, satisfyVPSC, solveVPSC,
  genXConstraints, genYConstraints,
} from './index';
```

## Acceptance Criteria

**Given** two rectangles that overlap in both X and Y,  
**When** `genXConstraints` and `genYConstraints` generate constraints and
`solveVPSC` is called once for X and once for Y with independent variable
arrays,  
**Then** no rectangle overlaps after solving (all `slack >= -1e-7` for all
generated constraints).

**Given** `IncVPSC.solve()` running on a layout with 10 nodes,  
**When** the solver converges,  
**Then** the final `|Δcost|` is `≤ 0.0001`.

**Given** X variables and Y variables created independently,  
**When** inspected after each solve pass,  
**Then** `xVars[i].block !== yVars[i].block` for all `i` (fully independent
block partitions — the X and Y block structures share no objects).

## Observability

N/A — algorithm library; no I/O.

## Rollback

Reversible. New files only. Revert by removing `src/vpsc/`.

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run src/vpsc/vpsc.test.ts` exits 0
- One commit: `feat(vpsc): port lib/vpsc IncVPSC solver`
- Tests must cover: overlap removal (AC 1), convergence threshold (AC 2),
  X/Y independence (AC 3), teardown order documented in JSDoc and tested
  by confirming no error thrown when calling `deleteVPSC → deleteConstraints
  → deleteVariable` in the correct order.
