# T1 — render-one-xdot.ts

## Context
graphviz-ts is a C-faithful TypeScript port of Graphviz. The SVG parity survey
uses `test/corpus/render-one.ts` — a spawned subprocess that renders ONE corpus
input to SVG and writes it to stdout, so a hang is killed by the parent's
wall-clock timeout. This task is the xdot analogue.

## Task
Create `test/corpus/render-one-xdot.ts`: read a corpus input path + engine from
argv, decode it the way native dot does, render to **xdot**, write to stdout.
Copy `render-one.ts` almost verbatim — the only change is the format.

- Reuse the exact `decodeDotInput` (strict UTF-8 → Latin-1 fallback) from
  `render-one.ts:decodeDotInput` — do not re-derive it.
- Import `parse` from `../../src/index.js` and `render` from
  `../../src/render/public.js`; emit `render(parse(decoded), 'xdot', { engine })`.
  (Engine is `'dot'` for the whole corpus, but keep the arg for symmetry.)
- On throw, write `__RENDER_ERROR__ <first line>` to stderr and `exit(1)`; on
  success write the xdot string to stdout. Same sentinel contract as render-one.
- Node-only dev/test infra. SPDX header `// SPDX-License-Identifier: EPL-2.0`.

## Read-set
- `test/corpus/render-one.ts` (whole file — it is short; mirror it)
- `src/render/public.ts:94-110` (the `render(g, format, opts)` signature)

## Interface contract (consumed by T3)
`tsx test/corpus/render-one-xdot.ts <inputPath> <engine>` →
stdout = xdot text on success (exit 0); stderr `__RENDER_ERROR__ …` + exit 1 on
throw; may hang (parent kills it).

## Acceptance criteria
- Given `printf 'digraph{a->b}' >/tmp/ab.dot`, when
  `npx tsx test/corpus/render-one-xdot.ts /tmp/ab.dot dot`, then stdout contains
  `_draw_` and exit code is 0.
- Given a non-existent path, when run, then stderr starts `__RENDER_ERROR__` and
  exit code is 1.
- Given a Latin-1 corpus input (e.g. `~/git/graphviz/tests/Latin1.dot` if
  present), when run, then it does not throw on decode.

## Observability / rollback
N/A — no new observable runtime operations. Reversible (new file).

## Quality bar
`npx tsc --noEmit` clean. One commit: `test(xdot): add render-one-xdot harness`.
