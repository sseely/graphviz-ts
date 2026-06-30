# T2 — dotRank honours the newrank attribute

## Context

`dotRank` (`src/layout/dot/rank.ts`) gates on `(g.info.flags ?? 0) & NEW_RANK`,
a bit nothing sets, instead of reading the `newrank` graph attribute. C
(`rank.c:523`): `if (mapbool(agget(g,"newrank"))) { GD_flags|=NEW_RANK;
dot2_rank(g); } else dot1_rank(g);`. Faithful one-line fix. `mapbool` already
exists in `rank.ts`.

## Task

In `dotRank`, replace the flag test with `mapbool(g.attrs.get('newrank'))`,
keeping the `g.info.flags |= NEW_RANK` set inside the branch (so downstream
`flags & NEW_RANK` checks in `mincross.ts` still fire). Update the JSDoc to cite
`rank.c:523`.

```ts
export function dotRank(g: Graph): void {
  if (mapbool(g.attrs.get('newrank'))) {
    g.info.flags = (g.info.flags ?? 0) | NEW_RANK;
    dot2Rank(g);
  } else {
    dot1Rank(g);
  }
}
```

## Write-set

- `src/layout/dot/rank.ts` — `dotRank` body
- `src/layout/dot/rank.test.ts` — add/extend a unit test

## Read-set

- `~/git/graphviz/lib/dotgen/rank.c:521-530`
- `src/layout/dot/rank.ts:dotRank`, `mapbool`

## Acceptance criteria

- **Given** a graph with `newrank=true`, **when** `dotRank` runs, **then**
  `g.info.flags & NEW_RANK` is set and `dot2Rank` is taken (assert via a spy or
  by observing the NEW_RANK bit post-call).
- **Given** a graph without the attr (or `newrank=false`), **then** `dot1Rank`
  is taken and `NEW_RANK` is NOT set.
- **Given** the 122 goldens, **then** conformant (no golden sets newrank).

## Dependency / ordering

Depends on T3 landing in the same batch — do NOT leave `main`/branch HEAD in a
state where `newrank=true` hangs. If T3 isn't done, this commit waits.

## Quality bar

`tsc --noEmit` 0; lizard clean; vitest green; goldens conformant.
Commit: `fix(T2): dotRank honours the newrank attribute`.

## Observability / Rollback

N/A. Reversible (revert; attr-gated).
