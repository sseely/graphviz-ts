# T3 — xdot-walk.ts (the driver)

## Context
The SVG survey (`test/corpus/survey.ts`) spawns the native oracle and the port
subprocess, diffs, and writes `parity.json`. This task is a focused walker for
xdot: it consumes the **already-conformant** SVG set and drives them through xdot,
in ascending input-file-size order, stopping at the first divergence (default) or
surveying all (`--survey`).

## Task
Create `test/corpus/xdot-walk.ts`. Reuse `survey.ts` machinery — **import**
`spawnCapture` and the oracle-cache helpers if exported; if they are module-local,
lift the minimal pieces (do not fork the whole file). Env/paths must match
survey.ts exactly: `DOT_BIN`, `GVBINDIR` (default `/tmp/ghl` for this walker —
NOT `/tmp/gvplugins`; see below), `CORPUS_ROOT` (`~/git/graphviz/tests`), the
sha1(binary,GVBINDIR,mtime) oracle-cache namespacing.

Steps:
1. Read `test/corpus/parity.json`; take entries with `verdict === "conformant"`.
2. Resolve each `path` under `CORPUS_ROOT`; `statSync(...).size`; **sort ascending
   by size**, tie-break by `id`.
3. For each item:
   - Oracle: `spawnCapture(DOT_BIN, ['-Txdot', absInput], { ...process.env,
     GVBINDIR }, ORACLE_TIMEOUT)`, cached by id under the namespaced cache dir.
   - Port: `spawnCapture(tsx, [render-one-xdot.ts, absInput, 'dot'], …, budget)`.
   - `compareXdot(port, oracle)` (T2).
   - Classify: `conformant` (no diffs), `diverged` (diffs), `port-error`,
     `oracle-error`, `timeout`. Treat ids listed in
     `accepted-divergences-xdot.json` as non-blocking (`accepted`).
4. **Default mode:** on the first non-accepted `diverged`/`error`, print the item
   id, path, size, and the full `XdotDiff[]` (object → drawKey → opIndex → field →
   actual/expected/delta), then exit 0. This is the "fix this next" report.
5. **`--survey` mode:** process all items, write `test/corpus/xdot-parity.json`
   (shape below), print a summary line, exit 0. Only a harness fault (missing
   oracle binary, unreadable manifest) exits nonzero.

Concurrency: survey mode may use the same `SURVEY_CONCURRENCY` pattern; default
(stop-on-first) mode is inherently sequential — walk in size order and bail early.

## Read-set
- `test/corpus/survey.ts:30-75` (env/paths/oracle-sig/cache), `:160-260`
  (`spawnCapture`, oracle + port spawn, timeout budget)
- `test/corpus/parity.json` (entry shape `{id, path, verdict}`)
- `test/corpus/render-one-xdot.ts` (T1) and `test/golden/compare-xdot.ts` (T2)

## Interface contract
`xdot-parity.json` (consumed by T4):
```jsonc
{
  "generatedAt": "<iso>",            // stamp AFTER run; do not call Date.now() mid-walk if resumability matters
  "oracle": "dot -Txdot @ /tmp/ghl",
  "total": 759,
  "counts": { "conformant": N, "diverged": N, "accepted": N, "port-error": N, "oracle-error": N, "timeout": N },
  "results": [ { "id": "121", "path": "121.dot", "size": 249, "verdict": "conformant",
                 "diffs": [ /* XdotDiff[] when diverged, capped to ~20 */ ] } ]
}
```
Results ordered by ascending size (same order the walk used).

## Acceptance criteria
- Given the conformant set, when `npx tsx test/corpus/xdot-walk.ts` (default),
  then it prints exactly one item (the smallest diverging one) with a structured
  op-level diff and exits 0.
- Given `--survey`, when run, then `xdot-parity.json` exists with `total` = number
  of conformant entries and `results` sorted by ascending `size`.
- Given an id in `accepted-divergences-xdot.json`, when it diverges, then it is
  classified `accepted` and does NOT halt default mode.
- Given `DOT_BIN` missing, when run, then exit code is nonzero with a harness-fault
  message (parity with survey.ts).

## Observability / rollback
The walk report IS the observability. Reversible (new file).

## Quality bar
`npx tsc --noEmit` clean. One commit: `test(xdot): add size-sorted conformance walker`.
