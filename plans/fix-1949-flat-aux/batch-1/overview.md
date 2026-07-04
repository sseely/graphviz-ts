# Batch 1 — Diagnose (instrument-first, sequential)

Instrument both sides of `make_flat_adj_edges`, diff the aux graphs for 1949,
and pin the first divergence. **No committed code changes** — all
instrumentation is temporary and reverted. T2 depends on T1's C dump.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Clean-rebuild C graphviz + instrument C `make_flat_adj_edges` aux dump for 1949 | direct (opus) | none committed (temp C `fprintf`, reverted) | — | [ ] |
| T2 | Instrument port `makeFlatAdjEdges` aux pipeline; diff C vs port; pin root cause | direct (opus) | none committed; pinned cause → `.agent-notes/1949-diagnosis.md`, `decision-journal.md` | T1 | [ ] |

**Exit criteria:** a written mechanism/origin/causal-chain/ruled-out artifact
(per `~/.claude/rules/diagnosis.md`) naming the exact first field where the
port's aux graph diverges from C's — e.g. "auxt lands at aux-x X in port vs Y
in C because rank=source is absent", or "aux `:S` endpoint attaches to node N
in port vs M in C". No fix is written in Batch 1.
