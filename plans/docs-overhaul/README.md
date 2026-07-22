<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: Documentation overhaul + image-embedding API

## Objective

Bolster graphviz-ts documentation to a React/Angular-style standard: a
comprehensive information architecture (Guide / Recipes / Reference), a
hand-written **types reference** with shapes and relationships, a
**recipes cookbook** harvested from the real `plantuml-ts` consumer, a
dedicated **images guide** (including CSP `img-src` guidance for
playground/embed pages), auto-generated **TypeDoc** API reference wired
into the existing VitePress site, and **migration pages**. Ship one small
additive library feature — a `setImageResolver` + `render({ inlineImages })`
API that inlines external images as `data:` URIs so output SVGs can be
self-contained. Finally, fix the dashboards so test references link to the
canonical **gitlab** source instead of leaking local machine paths.

## Branch

`feature/docs-overhaul` (create from `main`). Merge with a **merge commit**
(mission-brief convention — preserve per-task commit IDs).

## Scope boundary

- **In:** docs-site content + IA, TypeDoc toolchain, one additive image
  API (`src/`), dashboard link hygiene (`test/corpus/`).
- **Out:** any layout/algorithm change, any change to emitted SVG bytes when
  `inlineImages` is unset, any new engine or format, raster/PDF output.

## Constraints (stop conditions)

STOP and wait for human input when:
- A task needs to write a file outside its declared write-set that no other
  task owns.
- Two consecutive quality-gate failures on the same check.
- **T1 changes emitted SVG bytes when `inlineImages` is unset** — the
  default-off path must be byte-identical to `main`. This is a hard stop.
- TypeDoc or `docs:build` fails in a way needing a toolchain/version choice.
- An architecture decision in [decisions.md](./decisions.md) is contradicted.

PUSH FORWARD with judgment on:
- Doc wording, page structure, heading order.
- Mermaid diagram styling and content choices.
- Which recipes to harvest from `plantuml-ts` and how to trim them.
- Glossary term selection; sidebar ordering within the agreed groups.
- Minor devDependency patch/minor version choices for TypeDoc plugins.

## Quality gates

Run between batches and at session end. See
`~/.claude/rules/autonomous-execution.md` for the gate protocol.

```
- command: npm run typecheck
  pass: exit 0
  on_fail: fix_and_rerun
- command: npm test
  pass: exit 0
  on_fail: fix_and_rerun
- command: npm run build
  pass: exit 0
  on_fail: fix_and_rerun
- command: npm run docs:build
  pass: exit 0 (VitePress + copy-reports + TypeDoc all succeed)
  on_fail: fix_and_rerun
- command: git diff --name-only <batch-base>
  pass: output matches the batch's declared write-sets only
  on_fail: stop
```

A corpus sweep is **not** required (no layout change). T1's own tests must
prove the default-off emit path is byte-identical; that substitutes for a
full sweep on the render change.

## Batches

- [x] **Batch 1 — Foundations** ([overview](./batch-1/overview.md)) — code +
  toolchain. T1 image API · T2 gitlab links · T3 TypeDoc · T4 TSDoc gap-fill.
- [x] **Batch 2 — Content pages** ([overview](./batch-2/overview.md)) — T5
  types · T6 recipes · T7 images · T8 overview · T9 migration · T10 glossary ·
  T11 API reference.
- [ ] **Batch 3 — Integration** ([overview](./batch-3/overview.md)) — T12 IA
  overhaul (sidebar, landing, getting-started).

## Index

- [decisions.md](./decisions.md) — architecture decisions (locked)
- [decision-journal.md](./decision-journal.md) — appended during execution
- [diagrams/component-map.md](./diagrams/component-map.md) — what changes, how it relates
- [diagrams/data-flow.md](./diagrams/data-flow.md) — image-inline + docs-build flows

## Model

Recommended executor: `claude-fable-5` (long-horizon, 1M context) via
`~/.claude/hooks/autonomous-toggle.sh on .`. Content tasks (Batch 2) may be
dispatched to Sonnet subagents; T1 (src feature) warrants Sonnet at high
effort.
