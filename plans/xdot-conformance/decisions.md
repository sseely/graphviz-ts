# Architecture Decisions — xdot conformance

## AD-1 — Semantic comparator over parsed op streams
**Context:** xdot output is DOT syntax carrying draw-op strings; literal/byte
compare drowns in formatting noise (`width=.75` vs `0.75`, attr order, the
`node [label="\N"]` default line).
**Decision:** Parse both sides with `src/xdot/parseXDot` into typed `XdotOp[]`,
key ops by object (graph / node-name / edge `tail->head`), compare opcode
sequence exactly, numbers at **0.01** tolerance, colors and font names
canonicalized first. Ignore all attribute formatting/ordering.
**Consequences:** Divergence means a real geometry/color/text difference. Mirrors
`compareSvg`'s tolerance philosophy. Cosmetic differences are invisible by design.

## AD-2 — Conformant set = SVG-conformant corpus, sorted by input size
**Context:** Need the "known conformant for dot" list and a small→large order.
**Decision:** Read `test/corpus/parity.json`, take `verdict === "conformant"`
(759 entries: `{id, path, verdict}`), resolve `path` under `CORPUS_ROOT`
(default `~/git/graphviz/tests`), sort ascending by `statSync(...).size`.
**Consequences:** Simple graphs pin core bugs first; edge cases accumulate as
size grows — the user's stated hypothesis.

## AD-3 — Stop-on-first-divergence, fix, resume
**Context:** Two options: log-all-then-fix, or pause-and-fix each.
**Decision:** Walker default halts at the first diverging item with a detailed
op-level diff. Fix at root, re-run. Fix-loop, not a fixed task list.
**Consequences:** Fixes land in dependency order; each fix is validated before
the next divergence is even seen.

## AD-4 — Oracle: native `dot -Txdot`, GVBINDIR=/tmp/ghl
**Context:** The SVG survey oracle is native dot + headless plugins at /tmp/ghl.
**Decision:** Same binary (`~/git/graphviz/build/cmd/dot/dot`), same GVBINDIR,
invoked `['-Txdot', absInput]`. Reuse `survey.ts` `spawnCapture` + the
sha1(binary, GVBINDIR, mtime) oracle-cache namespacing.
**Consequences:** Identical layout basis to the SVG conformant verdicts, so any
xdot divergence is emission, not a different oracle build.

## AD-5 — Scope: plain xdot v1.7 only
**Context:** `dot.ts` AD-12 already excludes FORMAT_CANON / XDOT12 / XDOT14.
**Decision:** Target `xdot` (version 1.7) exclusively.
**Consequences:** No versioned-op backfill; matches the existing renderer scope.

## AD-6 — Deliverable: both walker modes
**Context:** Original ask was a full fix-up list; revised ask was stop-and-fix.
**Decision:** Default = stop-on-first (fixing). `--survey` renders all conformant
items and writes `xdot-parity.json` + `PARITY-XDOT.md`.
**Consequences:** Full list (original ask) + permanent regression gate, without
losing the stop-and-fix workflow.

## AD-7 — Irreducible C quirks: accept and continue
**Context:** SVG conformance carries an accepted-divergence ledger (A2/A3/A8).
**Decision:** When a divergence resists a cheap faithful fix and is a platform
quirk (font-metric ULP, libm), record `{id, opClass, delta, rationale}` in
`test/corpus/accepted-divergences-xdot.json`; the walker treats accepted ids as
non-blocking and continues.
**Consequences:** Momentum on the many-bug walk; irreducibles are documented, not
hidden. Every accepted entry needs a written rationale.

## Rollback classification
**Reversible.** Renderer + test-harness changes only; `git revert` restores prior
behavior. No data model, no persisted state, no external contract. `render(g,
'xdot')` / `getDrawOps` move from broken→correct — non-breaking (no consumer
depends on the broken output; plantuml-ts is SVG-centric).
