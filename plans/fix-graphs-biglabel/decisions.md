# Architecture Decisions

All five approved by the user during planning.

## AD-1: C-oracle instrumentation via the gvplugin harness
- **Context.** Need the oracle's routing boxes + Proutespline in/out for edge
  `struct1:f2→struct3:here` to find the first divergence.
- **Decision.** Use the established `gvplugin_dot_layout → /tmp/gvplugins`
  harness (memory `recover-slack-and-c-harness`); do NOT printf-patch
  `~/git/graphviz` source.
- **Consequences.** Reproducible; keeps the C tree clean; one-time plugin build.

**Harness/env note.** The survey npm scripts call a bare `tsx`. When
`node_modules/.bin/tsx` is absent, invoke via the npx cache:
`TSX=$(ls ~/.npm/_npx/*/node_modules/.bin/tsx | head -1)` then
`TSX_BIN="$TSX" GVBINDIR=/tmp/ghl PARITY_OUT=parity-rules.json "$TSX" test/corpus/survey.ts`.
Oracle dir `/tmp/ghl` is built by `npm run survey:setup`.

## AD-2: Fix at the mechanism origin, not symptom sites
- **Context.** Spline routing spans box-construction → corridor → Proutespline
  fit; the symptom (piece count) surfaces late.
- **Decision.** Fix the single site where port geometry first departs from C
  (`diagnosis.md`); no multi-file symptom patching.
- **Consequences.** Targeted, one `src/` file; a shared-primitive origin is
  stated explicitly with justification.

## AD-3: Definition of done
- **Context.** Edge splines can carry irreducible Apple-libm ULP residuals
  (memory `2368`, `byte-match-is-the-bar`).
- **Decision.** Target `conformant` (byte-match). Accept `structural-match`
  ONLY if T2 proves the residual is platform-libm FP, documented with a
  comparison page + decision-journal entry (CLAUDE.md override).
- **Consequences.** Honest bar; no forced byte-match, no premature acceptance.

## AD-4: Shared-primitive regression guard
- **Context.** A change in `splines-routespl.ts`/Proutespline touches many
  corpus edges.
- **Decision.** Prefer the narrowest fix; `npm run survey:gate` (0 regressions
  across 789 corpus) is the mandatory guard; any other-id regression → STOP.
- **Consequences.** Protects the 745 conformant/structural graphs.

## AD-5: Not-a-port-bug escape
- **Context.** Node sizes/endpoints already match — strongly suggests a real
  port routing bug, but T2 must confirm.
- **Decision.** If T2 proves the divergence is oracle-side or irreducible
  platform FP (not an algorithmic port defect), STOP and classify as
  accepted-divergence (1472 precedent); do not force a `src/` change.
- **Consequences.** Prevents fabricating a fix; requires the comparison-page
  artifact if accepted.

## Rollback

Reversible — revert the branch. No migration; parity artifacts regenerate from
the survey. Batch 1 makes no `src/` change; Batch 2 changes exactly one pinned
`src/` file.
