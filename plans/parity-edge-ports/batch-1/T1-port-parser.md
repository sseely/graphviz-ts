# T1 — port struct + parser wiring (AD3)

## Context

graphviz-ts: faithful browser-targeted TS port of C graphviz; C at
`~/git/graphviz/lib` (tag 15.0.0) is the spec. Vitest, strict TS,
JSDoc @see per ported block. Suite baseline 1466/0, 82 goldens.
Hook rule: smallest fix, ≤2 attempts per file, then move on.
Hook limits: 30 lines/fn, CCN 10, 5 params, 500 lines/file.

DOT syntax `A:port:compass` and `A:port` are PARSED by the PEG grammar
(`parser/dot.pegjs:120-127`) into `NodeId.port` and `NodeId.compass`,
but `builder.ts:168` calls `registry.ensure((item as NodeId).id, root)`
— it only uses `.id` and silently drops `.port` and `.compass`. The C
path (cgraph grammar → sets `tailport`/`headport` edge attrs → read by
`common_init_edge`) requires the port string to land in the edge attrs,
not in the `EdgeInfo` struct directly. This task wires the two paths.

## Task

1. In `src/parser/builder.ts`, update `processEdgePair` so that when
   a `NodeId` carries a non-empty `.port` field, the value
   `port + (compass ? ':' + compass : '')` is written into the edge's
   `attrs` map under the key `"tailport"` (for tail) and `"headport"`
   (for head). Write only when non-empty — do NOT overwrite an explicit
   `tailport=`/`headport=` attribute that was already set via `attrs`.
   Priority: explicit attr wins over DOT syntax (C semantics: `mkport`
   sets the attr; explicit attrs are set earlier). @see
   `lib/cgraph/grammar.y:396` (mkport) and
   `lib/dotgen/dotinit.c:common_init_edge`.
2. Add unit tests in `src/parser/builder.test.ts` (or create it) that
   verify `A:s -> B:n` produces an edge with `tailport="s"` and
   `headport="n"` in `edge.attrs`, and `A:f0:ne -> B` produces
   `tailport="f0:ne"`.
3. TDD: write failing tests first, then implement.

## Write-set (strict — nothing else)

- `src/parser/builder.ts`
- `src/parser/builder.test.ts` (create or extend)

## Read-set

- `~/git/graphviz/lib/cgraph/grammar.y:390-410` — mkport, DOT syntax →
  attr writes
- `~/git/graphviz/lib/common/utils.c:489-510` — chkPort (understand the
  colon-split on the string that common_init_edge reads)
- `src/parser/builder.ts` — full file (the only write target)
- `src/parser/dot.pegjs:115-135` — confirm NodeId.port/.compass fields
- `src/model/edge.ts` — Edge.attrs type
- `src/common/edge-label-init.ts:195-260` — what initEdgeLabels reads
  today (ensure tailport/headport attrs will be visible there in T2)

## Architecture decisions (locked)

AD3 (parser writes to edge attrs, not to EdgeInfo directly), AD-C1.

## Interface contract (consumed by T2)

After T1, an edge created from `A:s -> B:n;` will have:

```ts
edge.attrs.get('tailport') === 's'
edge.attrs.get('headport') === 'n'
```

An edge created from `A:f0:ne -> B;` will have:

```ts
edge.attrs.get('tailport') === 'f0:ne'
```

An edge with explicit `[tailport="e"]` and DOT-syntax `:s` on the same
endpoint: explicit attr wins — `tailport` remains `"e"`.

## Acceptance criteria

- Given `A:s -> B:n`, when built, then `edge.attrs.get('tailport') ===
  's'` and `edge.attrs.get('headport') === 'n'`; tsc clean; 1466
  vitest pass; 82 goldens byte-identical (no render change yet)
- Given `A:f0:ne -> B`, when built, then `edge.attrs.get('tailport') ===
  'f0:ne'`
- Given `A -> B [tailport="e"]` (explicit attr only), when built, then
  `edge.attrs.get('tailport') === 'e'`
- Given `A:s -> B [tailport="e"]` (both), when built, then
  `edge.attrs.get('tailport') === 'e'` (explicit wins)

## Quality bar

`npx tsc --noEmit` clean. `npx vitest run` 0 failed, ≥1466 passed.
82 goldens byte-identical. No `any` except documented C-interop.
Commit: `feat(T1): wire NodeId port/compass into edge tailport/headport
attrs`.
