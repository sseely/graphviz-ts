# Mission: x-coordinate NS degeneracy (honda-tokoro repro)

## Objective
Make the port's x-coordinate (cross-rank position) network simplex resolve
weight=0 edge slack the same way native C does, so `graphs-honda-tokoro`
byte/structurally matches native dot. This is the small (24-node) repro of the
documented-hard x-NS optimal-face-selection class (cf. 2371). The fix must be
**faithful to C** (`lib/dotgen/position.c` + `lib/common/ns.c`), not a
honda-specific hack.

## Branch
- Work branch: `fix/xcoord-ns-degeneracy`
- Baseline commit: see `git log -1` at mission start
- Merge: `--no-ff` to `main`; **user pushes** (push is gated).

## What we already know (do not re-derive)
- honda-tokoro diverges ONLY in within-rank cross-coord (cy in this LR graph);
  ranks (cx) are byte-identical. Node groups shift 5/7px.
- Setting the two `weight="0"` edges (`n022->n004`, `n022->n008`) to
  `weight="1"` makes native and port **byte-identical** → weight=0 slack is the
  driver.
- `weight_class ?? 2` → `?? 0` (classify.ts:75) had **zero** effect (ruled out).
- C runs the x-coord NS as `rank(g, 2, …)` (position.c:142) → balance mode 2 =
  `LR_balance`. Port equivalent: `lrBalance` (ns.ts:311).
- See `.agent-notes/2371-is-xcoord-ns-solution-selection.md` for the class.

## Constraints
- Full stop/push-forward + the **write-set expansion rule** →
  [decisions.md#stop-conditions](decisions.md).
- Faithful to C only; no honda-specific special-casing (ADR-3).
- C-source edits are **temporary instrumentation only**, reverted before final
  validation (T4).

## Quality gates (run from repo root)
```
export PATH="$HOME/.npm/_npx/fd45a72a545557e9/node_modules/.bin:$PATH"
npm run typecheck            # tsc, must be clean
npm test                     # vitest, all pass
npm run survey               # writes test/corpus/parity-rules.json (headless)
npm run survey:gate          # must print "GATE PASS", 0 regressions
# pango baseline refresh (T4):
GV_TEXT_MEASURER=lut GVBINDIR=/tmp/gvplugins ORACLE_CACHE=$TMPDIR/oracle-pango-$(date +%s) \
  PARITY_OUT=parity.json tsx test/corpus/survey.ts
npm run survey:dashboard     # regenerates test/corpus/PARITY.md
```
Oracle rebuild: `cmake --build ~/git/graphviz/build --target gvplugin_dot_layout dot`
then `sh test/corpus/gen-headless-gvbindir.sh` (regens `/tmp/ghl`).

## Definition of done (ADR-5)
- REQUIRED: honda-tokoro byte/structural match; `npm test` green; **0 survey
  regressions** on BOTH baselines (`parity-rules.json` + `parity.json`).
- STRETCH (must not regress): 2371 / compress family / 1658 x-shifts.

## Batches (sequential — each consumes the prior's output)
| # | Goal | Status | Doc |
|---|------|--------|-----|
| 1 | Capture C 4-stage oracle dump | [x] | [batch-1/overview.md](batch-1/overview.md) |
| 2 | Instrument port, diff, localize divergence | [ ] | [batch-2/overview.md](batch-2/overview.md) |
| 3 | Apply faithful fix + unit test | [ ] | [batch-3/overview.md](batch-3/overview.md) |
| 4 | Revert instrument, validate, commit | [ ] | [batch-4/overview.md](batch-4/overview.md) |

## Index
- [decisions.md](decisions.md) — ADR-1..5 + stop conditions
- [decision-journal.md](decision-journal.md) — appended during execution
- [diagrams/component-map.md](diagrams/component-map.md) — affected components
- [diagrams/data-flow.md](diagrams/data-flow.md) — x-coord NS pipeline
- `oracle/` — c-dump.txt / port-dump.txt (created during T1/T2)
