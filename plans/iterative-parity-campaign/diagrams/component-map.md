# Component Map

How corpus inputs flow through the native oracle, the injection
harness, and the reporting pipeline this mission builds.

```mermaid
graph TD
  Corpus["test/corpus inputs\n(.gv/.dot, 762 items)"]
  Oracle["native oracle\ndot -K <engine> -Txdot\n(~/git/graphviz/build/cmd/dot/dot,\nGVBINDIR=/tmp/ghl)"]
  DumpPatch["session-local POS_DUMP patch\n(lib/neatogen spline_edges entry,\n%.17g stderr, never committed)"]
  EngineWalk["test/corpus/engine-walk.ts\n-> parity-<engine>.json"]
  Attribute["test/corpus/attribute-divergence.ts\n(T1: --stage pre-routing,\noracle-hash guard)"]
  Inject["src/layout/neato/splines.ts\nGVTS_POS_INJECT hook\n(committed, env-gated, browser-inert)"]
  OracleErr["test/corpus/oracle-error-classifier.ts\n(T3: D6 3x-rerun split)"]
  AttrJson["attribution-<engine>.json\n+ oracle-errors-<engine>.json"]
  Accept["accepted-divergences-engines.json\n(A1-drift class entries, D2)"]
  Report["test/corpus/parity-report.ts\n(T2: class rendering)"]
  Pages["PARITY-<engine>.md pages\n+ docs/known-divergences.md"]
  Site["docs-site (vitepress)\nnpm run docs:build -> gh-pages"]
  SrcFix["src/ fix surface\n(diagnosed per round, batch-3)"]

  Corpus --> Oracle
  DumpPatch -.->|patches, session-local| Oracle
  Oracle --> EngineWalk
  Corpus --> EngineWalk
  EngineWalk --> AttrJson
  Oracle --> Attribute
  Attribute --> Inject
  Inject --> Attribute
  Attribute --> AttrJson
  Oracle --> OracleErr
  OracleErr --> AttrJson
  AttrJson --> Accept
  AttrJson --> Report
  Accept --> Report
  Report --> Pages
  Pages --> Site
  AttrJson -.->|bucket ranking, batch-2/3| SrcFix
  SrcFix -.->|fresh sweep, 0 regressions| EngineWalk
```

Legend: solid arrows are data flow; dashed arrows are feedback loops
(the diagnosis→fix→re-sweep cycle in batch-3, and the session-local
native patch that is applied and reverted per injection run, never
resident in the C tree between runs).
