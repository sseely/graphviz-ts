# T2 — chkPort + common_init_edge port block (AD4)

## Context

graphviz-ts: faithful browser-targeted TS port of C graphviz; C at
`~/git/graphviz/lib` (tag 15.0.0) is the spec. Vitest, strict TS,
JSDoc @see per ported block. Suite baseline 1466/0, 82 goldens.
Hook rule: smallest fix, ≤2 attempts per file, then move on.
Hook limits: 30 lines/fn, CCN 10, 5 params, 500 lines/file.

T1 has landed: `builder.ts` now writes `tailport`/`headport` into
`edge.attrs`. This task ports the C `chkPort` helper and the port
block of `common_init_edge` (lines 548–566 of `lib/common/utils.c`)
into `src/common/edge-label-init.ts`. After this task, every edge with
a `tailport` or `headport` attr (set via DOT syntax OR explicit attr)
will have `ED_tail_port` / `ED_head_port` populated on the `EdgeInfo`
instead of remaining zero-initialized — but the portfn for all shapes
is still `null` at this point, so `chkPort` will return a zero-init
port with `defined: false`. That is correct: the port geometry lands in
T3/T4. This task's job is purely the wiring and the `chkPort` split.

## Task

1. Port `chkPort` as a non-exported helper in
   `src/common/edge-label-init.ts`:
   ```
   function chkPort(
     pf: ((n: Node, name: string, compass: string | null) => Port) | null,
     n: Node,
     s: string,
   ): Port
   ```
   Logic: split `s` at first `':'`; if compass suffix exists, call
   `pf(n, name, compass)` or return zero-port if `pf` is null; set
   `port.name` to the compass string (per C: `pt.name = cp+1`). When
   no colon, call `pf(n, s, null)` or zero-port; set `port.name = s`.
   @see `lib/common/utils.c:489`.

2. Add a port block at the end of `initEdgeLabels` (after the existing
   label block) mirroring `common_init_edge:548–566`:
   - Read `e.attrs.get('tailport') ?? ''`; if non-empty, set
     `e.tail.info.has_port = true`, then
     `e.info.tail_port = chkPort(tailShape?.fns.portfn ?? null, tail, str)`
   - Read `e.attrs.get('headport') ?? ''`; same for head
   - After each `chkPort`, check for `noclip` attr (C: `noClip(e,
     E_tailclip)`) — if the edge has `tailclip="false"`, set
     `e.info.tail_port.clip = false`; same for headclip.
   @see `lib/common/utils.c:548-566`.

3. Add tests in `src/common/edge-label-init.test.ts`:
   - `chkPort` with null portfn returns zero-port with `name` set
   - `chkPort` with a stub portfn that returns a fixed port calls it
     with the correct name/compass split
   - `initEdgeLabels` on an edge with `tailport="s"` sets
     `e.info.tail_port.name === 's'`; with `tailport="f0:ne"` sets
     `name === 'ne'` (the compass suffix per C `pt.name = cp+1`)

## Write-set (strict — nothing else)

- `src/common/edge-label-init.ts`
- `src/common/edge-label-init.test.ts` (extend)

## Read-set

- `~/git/graphviz/lib/common/utils.c:489-566` — chkPort + port block
- `src/common/edge-label-init.ts` — full file (only write target)
- `src/common/edge-label-init.test.ts` — existing tests (extend, don't break)
- `src/common/types.ts:270-285` — ShapeFunctions.portfn signature
- `src/model/edgeInfo.ts:20-45` — tail_port/head_port fields + makePort()
- `src/layout/dot/init.ts:177-200` — dotInitEdge (to verify no
  double-init after T2 lands)
- `src/model/node.ts` — NodeInfo.has_port field location

## Architecture decisions (locked)

AD3 (port block reads edge attrs), AD4 (chkPort as free function),
AD-C1.

## Interface contract (consumed by T3, T4, T5, T6)

After T2 + T3/T4 land, an edge built from `A:s -> B:n` will have:
```ts
e.info.tail_port.name === 's'
e.info.tail_port.defined === true  // after T3 sets portfn
e.info.head_port.name === 'n'
```
Before T3, with portfn still null:
```ts
e.info.tail_port.name === 's'
e.info.tail_port.defined === false  // portfn returned zero-port
e.info.tail_port.p === { x: 0, y: 0 }
```

## Acceptance criteria

- Given an edge with no port attrs, when `initEdgeLabels`, then
  `e.info.tail_port` remains the default zero-port (`defined: false`)
  — no regression on existing 82 goldens
- Given an edge with `tailport="s"` and portfn null, when
  `initEdgeLabels`, then `e.info.tail_port.name === 's'` and
  `e.info.tail_port.defined === false`
- Given an edge with `tailport="f0:ne"`, when `initEdgeLabels`, then
  `chkPort` is called with `(n, 'f0', 'ne')` (confirmed by stub)
- Given an edge with `tailclip="false"`, when `initEdgeLabels`, then
  `e.info.tail_port.clip === false`
- tsc clean; 0 vitest failed; 82 goldens conformant

## Quality bar

`npx tsc --noEmit` clean. `npx vitest run` 0 failed, ≥1466 passed.
82 goldens conformant. Commit: `feat(T2): port chkPort and
common_init_edge port block`.
