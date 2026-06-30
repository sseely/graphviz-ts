# T4 — map_rec_port + record_port (AD5)

## Context

graphviz-ts: faithful browser-targeted TS port of C graphviz; C at
`~/git/graphviz/lib` (tag 15.0.0) is the spec. Vitest, strict TS,
JSDoc @see per ported block. Suite baseline 1466/0, 82 goldens.
Hook rule: smallest fix, ≤2 attempts per file, then move on.
Hook limits: 30 lines/fn, CCN 10, 5 params, 500 lines/file.

Batch 1 (T1, T2) is done. T3 (compassPort + poly_port) runs in
parallel with this task — T4 is independent from T3's write-set.
Record shapes are fully ported (`src/common/record.ts` has field IDs
via `HASPORT`/`INPORT` flags and `fp.id` at line 155). The missing
piece is the `map_rec_port` recursive field-tree walker and the
`record_port` entry function, plus wiring `RECORD_FNS.portfn`.

## Task

1. Port `map_rec_port(f, str)` in `src/common/record.ts` (or a new
   `src/common/record-port.ts` if the 500-line limit on `record.ts` is
   already tight — check before deciding):
   - Recurse the `FieldT` tree: if `f.id === str` return `f`; if
     `f.n_flds > 0` recurse into `f.fld[i]`; return `null`.
   @see `lib/common/shapes.c:3716`.

2. Port `record_port(n, portname, compass)` in the same file:
   - Get the record label's top field `f = ND_label(n).u.txt` (or the
     TS equivalent — `node.info.label?.u?.record?.root` field; read
     record.ts to find the exact field name).
   - Call `map_rec_port(f, portname)`: if found, call
     `compassPort(n, &subf.b, rv, compass, subf.sides, null)`.
   - If not found, fall back to `compassPort(n, &f.b, rv, portname,
     sides, null)` (treats portname as a compass direction on the whole
     record bbox).
   @see `lib/common/shapes.c:3732`.

3. Set `RECORD_FNS.portfn = record_port` in `src/common/shapes.ts`.

4. TDD tests in `src/common/record-port.test.ts` (or extend
   `record.test.ts` if in same file):
   - `map_rec_port` finds a field by `id`; returns null for missing id
   - `record_port` on a 3-field record (`<f0>L|<f1>M|<f2>R`) with
     portname `'f0'` returns a port whose `p.x` is within the left
     field's bbox (left third of node width)
   - `record_port` with portname `'f0'` and compass `'n'` applies
     compassPort on the field bbox
   - `record_port` with portname that is not a field ID falls back to
     compassPort on the whole record bbox

NOTE: `compassPort` is being ported in parallel (T3). Import it via its
declared signature from `src/common/compass-port.ts`; if T3 isn't
merged yet, stub it with a function that returns `makePort()` and note
the dependency. The mission executor must sequence T3's merge before
running the full golden suite.

## Write-set (strict — nothing else)

- `src/common/record.ts` OR `src/common/record-port.ts` (one file;
  choose based on line count of record.ts)
- `src/common/record-port.test.ts` OR `src/common/record.test.ts`
  extension (one file)
- `src/common/shapes.ts` (set RECORD_FNS.portfn only)

## Read-set

- `~/git/graphviz/lib/common/shapes.c:3716-3760` — map_rec_port,
  record_port (full)
- `src/common/record.ts` — full file (field tree structure, FieldT
  equivalent, field IDs set at line 155)
- `src/common/shapes.ts:49-55` — RECORD_FNS definition
- `src/model/geom.ts:85-100` — Port fields
- `src/model/edgeInfo.ts:330-345` — makePort()
- `src/common/compass-port.ts` — compassPort signature (from T3)

## Architecture decisions (locked)

AD1 (`Port.bp` = value copy of field bbox), AD5 (record ports in this
mission), AD6 (0.5 pt tolerance), AD-C1.

## Acceptance criteria

- Given a 3-field record node and `tailport="f0"`, when layout runs
  after T6, then the edge exits from the left-field bbox center (not
  node center); verify `e.info.tail_port.p.x < 0` (left of center)
  for a left-most field in a standard record
- Given `map_rec_port` with existing field id, then returns field; with
  non-existing id, returns null
- Given `record_port` with portname matching a field id and compass
  `'n'`, then returned port has `side === TOP`
- tsc clean; 0 vitest failed; 82 goldens conformant

## Quality bar

`npx tsc --noEmit` clean. `npx vitest run` 0 failed, ≥1466 passed.
82 goldens conformant. Commit: `feat(T4): port map_rec_port and
record_port; wire RECORD_FNS.portfn`.
