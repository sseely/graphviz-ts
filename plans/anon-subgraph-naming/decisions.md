# Architecture decisions

## ADR-1: Faithful port of cgraph's anonymous-id discipline
- **Context:** Native names anonymous objects `%<2*counter+1>` from one global
  counter shared by graph/node/edge, advanced only by *anonymous* objects.
- **Decision:** Reproduce that scheme exactly — a single per-parse counter,
  advanced in cgraph object-creation order by: the unnamed root graph, each
  anonymous subgraph, and each keyless edge (dot edges have no key → anonymous).
  Name = `'%' + (2*counter+1)`. Do NOT invent a simpler sequential scheme.
- **Consequences:** Matches native titles; requires the port to create objects
  in cgraph's order. The id need only be *materialized* lazily when a name is
  requested, but the counter must advance at creation time.

## ADR-2: Pin order against the C oracle before coding
- **Context:** The id values depend entirely on object-creation order; the port's
  parser may visit statements in a different order than cgraph.
- **Decision:** Instrument cgraph (or use `agnameof` dumps via a tiny C probe /
  `gvpr`-free object walk) to emit, for sample inputs, the `%N` assigned to each
  anonymous object in creation order; diff against the port's order. Stop at the
  first order mismatch (it names the parser-order fix needed).
- **Consequences:** Avoids guessing; isolates whether the gap is purely the
  formula/base or also a traversal-order divergence.

## ADR-3: Counter scope = per-parse, reset on entry
- **Context:** The library renders multiple diagrams per page; module globals
  must reset per render (memory `multi-diagram-global-state-safety`).
- **Decision:** The counter is builder-instance state (like the current
  `anonSeq`), initialized per parse. No module-level mutable global.
- **Consequences:** Multi-diagram safe by construction.

## ADR-4: Faithfulness over cosmetic shortcut
- **Context:** Titles are "cosmetic", but they are part of the SVG contract and
  drive parity verdicts.
- **Decision:** Treat title parity as a real correctness target; the fix must be
  a faithful port, verified by `%N`-equality against the oracle + 0 survey
  regressions, never by suppressing/normalizing titles.

## Rollback
Reversible — revert the mission commit. Pure naming; no data/schema change.
