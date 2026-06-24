# Mission: faithful anonymous-object naming (`%N`)

## Objective

The port names anonymous subgraphs `%0, %1, %2 …` (a per-builder counter over
anonymous *subgraphs* only). Native cgraph names them `%<id>` where `id` comes
from a **single global counter shared across all object types** — every
*anonymous* object (the unnamed root graph, each anonymous subgraph, each keyless
edge) consumes `id = 2*counter+1` and advances `counter`. Named objects (named
nodes, named subgraphs, keyed edges) get pointer-based even ids and do **not**
advance the counter.

This divergence makes every graph with anonymous subgraphs emit wrong SVG
`<title>` text (e.g. `2475_2`: port `%0,%1,%2…` vs native `%3,%9,%17,%21,…`),
forcing a `diverged` verdict on otherwise-correct layouts. This mission ports
cgraph's anonymous-id scheme faithfully so anon-subgraph titles match native.

## Evidence already gathered (do not re-derive)

- C ref: `lib/cgraph/id.c:62` `*id = st->counter * 2 + 1; ++st->counter;` (anon
  branch of `idmap`, the default `AgIdDisc`). Name format: `lib/cgraph/id.c:163`
  `"%c%" PRIu64` with `LOCALNAMEPREFIX='%'` (`cghdr.h:46`).
- `agmapnametoid` (`id.c:104`) routes unnamed objects (and `%`-prefixed names)
  to the anonymous branch; named objects to the string→pointer map.
- Arithmetic check on `2475_2` (`strict digraph {` → anon root):
  - root graph → `%1` (counter 0→1)
  - subgraph 1 → `%3` (counter 1→2); its **2** edges → counter 2→4
  - subgraph 2 → `%9` (counter 4→5); its **3** edges → counter 5→8
  - subgraph 3 → `%17` (counter 8→9) …
  Confirms: anon root + anon subgraphs + **keyless edges** all share one counter.
- Port today: `src/parser/builder.ts:130` `private anonSeq = 0;` and `:182`
  `const sgName = stmt.id ?? `%${this.anonSeq++}`;` — subgraph-only, wrong base.
- Impact surface: SVG `<title>` text only (cluster `id="clustN"` is a separate
  sequential counter and already matches). See memory `hang-2475-2-xcoord-ns`
  residuals and the e39072d commit (this was the tracked residual).

## Success bar

For graphs containing anonymous subgraphs, the port's emitted `%N` titles match
native exactly. Measured by: `2475_2` (and other anon-subgraph corpus inputs)
no longer diverge on a `title`/`text()` path **for the naming reason**, and the
parity survey shows **net improvement with 0 verdict regressions**.

## Branch

`fix/anon-subgraph-naming` off `main` (or stacked on `fix/xcoord-pivots` if not
yet merged — coordinate; `2475_2` acceptance needs the keepout fix present so the
graph reaches emission without timing out, though title compare is independent of
layout).

## Constraints

**Stop and wait for human input if:**
- Reproducing native's ids requires the port to create objects in a different
  order than cgraph and that order cannot be matched without restructuring the
  parser beyond `builder.ts` (+ at most one model file).
- The fix changes results *away* from native (any verdict regression).
- A representative input shows native's `%N` does **not** follow `2*counter+1`
  over (root, anon-subgraph, keyless-edge) creation order — the model is wrong;
  re-pin against the C oracle before coding.
- The fix would require changing > 2 source files.

**Push forward with judgment on:**
- Oracle probe details and which corpus inputs to sample for order edge-cases.
- Whether the counter lives on the builder or the graph model, as long as it is
  reset per parse (multi-diagram safety — see memory `multi-diagram-global-state-safety`).
- Test assertion style, as long as it pins port `%N` == native `%N`.

## Quality gates

| command | pass | on_fail |
|---|---|---|
| `npx tsc --noEmit` | exit 0 | fix_and_rerun |
| `npx vitest run` | exit 0, ≥2266 tests | fix_and_rerun |
| `npx tsx test/corpus/survey.ts` then per-id diff | 0 verdict regressions | stop |
| anon-title probe (≥2 inputs incl. 2475_2 subset) | port `%N` == native `%N` | fix_and_rerun |

## Batches

| Batch | Goal | Status |
|---|---|---|
| [Batch 1](batch-1/overview.md) | T0 early impact-confirm, then pin creation-order + anon-id model against the oracle | [x] |
| [Batch 2](batch-2/overview.md) | Port the shared anon-id counter + verify parity | [x] |

> **Gate before Batch 2 (T0):** first confirm where native actually emits
> `agnameof`-derived `%N` in `dot -Tsvg` (cluster `<title>` only, vs node/edge
> titles too) and how many corpus inputs have anon subgraphs reaching emission.
> That count bounds the verdict-flip payoff; if trivially small, stop and confirm
> scope with a human before investing in the port.

## Index

- [decisions.md](decisions.md) — ADRs
- [batch-1/overview.md](batch-1/overview.md) — T1 oracle order/id dump, T2 model pin
- [batch-2/overview.md](batch-2/overview.md) — T3 implement, T4 verify
- [diagrams/id-model.md](diagrams/id-model.md) — cgraph vs port anon-id model
- [decision-journal.md](decision-journal.md) — appended during execution
