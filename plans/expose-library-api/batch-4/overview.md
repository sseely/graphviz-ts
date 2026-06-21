# Batch 4 — Docs + follow-on

Documentation for the new capabilities, and the scaffold for the deferred
pack/pathplan mission. Independent → parallel. Depend on Batch 3 (stable API).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T10 | Capability guide pages | documentation-engineer | `docs-site/guide/*` (new pages) | T9 | [ ] |
| T11 | pack/pathplan follow-on brief scaffold | (orchestrator) | `plans/expose-pack-pathplan/README.md` | — | [ ] |

## Notes

- T10: confirm the docs-site structure first (`ls docs-site`); add pages under
  the existing layout and register them in the VitePress nav/sidebar config.
- T11 is the ADR-7 closing task — it scaffolds the next `/plan-mission` brief, it
  does NOT implement pack/pathplan.

## Gate after batch

`npm run typecheck && npm test && npm run build` exit 0; `npm run docs:build`
exit 0 (if T10 touched docs-site). `git diff --name-only` matches write-set.
