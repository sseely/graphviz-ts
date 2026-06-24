<!-- SPDX-License-Identifier: EPL-2.0 -->

# Comparison / documentation: the 7 `timeout` cases

Per project CLAUDE.md ("a mission/batch with any quarantined or excluded case is
not complete until its comparison page exists and is referenced in the decision
journal"), this page documents every dot-survey input that remains `timeout`
after this mission, plus the won't-fix `errored` set.

## Outcome summary

All 7 cases **render correct output** (the network simplex and acyclic phases
are byte-identical to before — verified by the full-corpus survey showing **0
changed verdicts**). They remain `timeout` in the survey because they exceed the
survey's **20 s wall-clock budget**, which is measured against the `tsx`
on-the-fly-transpile harness (`test/corpus/render-one.ts`) — ~1.4–1.6× slower
than the production esbuild `dist` bundle and run under multi-process CPU load.

What changed this mission (all byte-identical, 0 regressions):

- **NS hot path** — flat SoA `dfsRange` stack + iterative `rerank` (commit
  `8c7c1e8`).
- **NodeInfo shape-stabilization** — exits V8 dictionary mode; the real lever
  (commit `27463a0`). 2471: 27.5 s → ~18 s in `dist`.
- **acyclic iterative DFS** — browser-safe on deep chains; a 50k-node path no
  longer overflows the stack (commit `88ff118`).

The AD-1 premise (per-frame allocation) was **falsified by profiling** (GC 0.3%;
`dfsRange` still 47% after the SoA change; 386M steps identical to C). The true
cost was slow-mode `n.info` property access. See the decision journal.

## Per-case status

| id | path | native dot | port `dist` (after) | survey verdict | dominant cost |
|---|---|--:|--:|---|---|
| 2471 | `2471.dot` | 0.5 s | 18.1 s | timeout | network-simplex `dfsRange` (386M steps) |
| 2475_2 | `2475_2.dot` | 5 s | 15.7 s | timeout | NS `dfsRange` + 6 MB SVG emission |
| 2222 | `2222.dot` | — | 16.5 s | timeout | 23 MB SVG emission (NS is light) |
| graphs-b100 | `graphs/b100.gv` | 9.9 s | 31.9 s | timeout | NS `dfsRange` |
| graphs-b104 | `graphs/b104.gv` | 9.9 s | 32.4 s | timeout | NS `dfsRange` |
| 1718 | `1718.dot` | 13.7 s | 25.7 s | timeout | NS `dfsRange` (415M steps; heavy for native too) |
| 2108 | `2108.dot` | 14 s | 84.4 s | timeout | NS `dfsRange` + 22 MB SVG emission |

(Port times are the production `dist` bundle, single-process; the `tsx` survey
harness is slower still, so all 7 exceed 20 s there.)

### Why these are not rescued by byte-identical micro-optimization

The remaining gap is **constant-factor JS-vs-C overhead on the identical step
count**, not extra work. C runs `dfsRange`'s 386M steps at ~770M steps/s; the
port, after shape-stabilization, at ~50M steps/s. Closing the rest would require
either (a) changing the algorithm / iteration count (forbidden — the README caps
this mission at representation/per-op changes), or (b) a much larger data-model
rewrite (NS-local typed-array mirrors of every `ND_*` field), or (c) optimizing
the SVG-emission path for the 6–23 MB outputs (2222/2475_2/2108) — a separate
subsystem. Per the human decision ("apply shape-stab + document rest"), these are
documented rather than chased here.

`2222` is illustrative: its NS is light, but it emits a **23 MB** SVG — the
string-building/emission path, not layout, is its wall. No NS change can rescue
it; that belongs to an emission-perf mission.

## The 5 `errored` cases (T4 — won't-fix)

`1308_1`, `1474`, `1489`, `1494`, `1676` are **fuzzer-corrupted** inputs
(mojibake, null bytes, binary soup, truncated keywords). The strict peggy parser
rejects them at the first unparseable byte; native dot's error-recovering yacc
limps through and emits **garbage SVG** (confirmed via `dot -Tsvg`). No clean
per-construct grammar fix exists that would not weaken valid-DOT parsing (AD-5).
Left as `errored`; no code changed. Full per-id classification is in the decision
journal (T4 row).

## Follow-on (not in scope here)

- **NS per-op parity** — an NS-local typed-array `ND_*` mirror (par/low/lim/rank
  indexed by a dense node id) would close more of the constant factor; large
  blast radius, needs its own mission and byte-identity gate.
- **SVG emission perf** — the 6–23 MB outputs (2222/2475_2/2108) are emission-
  bound; a separate profiling pass on the string-builder path.
