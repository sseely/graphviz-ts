# T8 — goldens + C-oracle verify (orchestrator inline)

## Context

graphviz-ts: faithful browser-targeted TS port of C graphviz; C at
`~/git/graphviz/lib` (tag 15.0.0) is the spec. Suite baseline 1466/0,
82 goldens. Hook rule: smallest fix, ≤2 attempts per file, then move
on.

All port-implementation tasks (T1–T6, optionally T7) are done. This
task mints new golden fixtures for port-using inputs, verifies each
against the installed `dot -Tsvg` oracle, and runs the full gate suite.
This task is ORCHESTRATOR INLINE — it does not spawn an agent; the
executor runs it directly.

## Task

1. **Create new golden inputs** in `test/golden/inputs/`:
   - `dot-port-compass.dot` — `digraph G { A -> B [headport=n,
     tailport=s]; }` (covers attr syntax)
   - `dot-port-syntax.dot` — `digraph G { A:s -> B:n; }` (covers DOT
     port syntax)
   - `dot-port-lr.dot` — `digraph G { rankdir=LR; A -> B [headport=w,
     tailport=e]; }` (LR / flip-aware)
   - `dot-port-record.dot` — `digraph G { a [shape=record,
     label="<f0>L|<f1>M|<f2>R"]; b; a:f0 -> b; }` (record field port)
   - `dot-port-record-compass.dot` — `digraph G { a [shape=record,
     label="<f0>L|<f1>M"]; b; a:f0:n -> b; }` (field + compass)
   - `dot-port-compass-only.dot` — `digraph G { A:ne -> B:sw; }`
     (DOT compass-only syntax)
   - `dot-port-dyna.dot` — `digraph G { A:_ -> B; }` (dynamic port;
     resolvePort path)
   If T7 ran: `dot-port-html-cell.dot` — HTML table node with
   `<TD PORT="p1">` and `tailport="p1"` edge.

2. **Generate reference SVGs** for each new input using the installed
   `dot -Tsvg` binary. Place in `test/golden/refs/dot-port-*.svg`.

3. **Add manifest entries** in `test/golden/manifest.json` for each
   new fixture with tolerance class `0.5pt` (per AD6). APPEND only —
   never modify existing entries.

4. **Run the full gate suite:**
   ```
   npx tsc --noEmit
   npx vitest run
   OUTDIR=/tmp/ep-refs npx tsx .probes/render-all.ts
   ```
   Byte-compare all 82 existing refs — must be conformant.
   For each new fixture, compare TS output vs C ref at 0.5 pt
   tolerance; report any failures.

5. **If any new fixture fails tolerance:** diagnose the divergence,
   check whether it traces to an unported C branch within the
   mission's write-set. Fix if straightforward (≤2 attempts); journal
   and stop if it requires a write-set expansion.

6. **Commit golden fixtures separately** after all tests pass:
   commit `test/` and `test/golden/` changes only.

## Write-set (strict — nothing else)

- `test/golden/inputs/dot-port-*.dot` (new files)
- `test/golden/refs/dot-port-*.svg` (new files)
- `test/golden/manifest.json` (APPEND entries only)

## Read-set

- `test/golden/manifest.json` — existing entries (structure reference)
- `test/golden/suite.test.ts` — golden comparison mechanics
- `.probes/render-all.ts` — how to invoke the TS renderer for probing

## C oracle reference values (verified by running dot 15.0.0)

| Input | Expected path fragment |
|-------|----------------------|
| `A -> B [headport=n, tailport=s]` | `M27,-72C27,-60.62 27,-55.32 27,-47.45` |
| `A:s -> B:n` | `M27,-72C27,-60.62 27,-55.32 27,-47.45` (same) |
| `rankdir=LR; A -> B [headport=w, tailport=e]` | `M54,-18C65.38,-18 70.68,-18 78.55,-18` |
| `a [shape=record, label="<f0>L\|<f1>M\|<f2>R"]; b; a:f0 -> b` | exits from left-field bbox center (x ≈ -18 from node center) |

## Acceptance criteria

- Each new TS-rendered SVG matches its C oracle at ≤0.5 pt on every
  path control point
- All 82 pre-existing golden refs are conformant to their state
  before T1 ran
- `npx vitest run` passes with 0 failed, ≥1466+N_new tests
- `npx tsc --noEmit` exit 0
- Manifest has N_new new entries (7 without T7, 8 with); all existing
  entries unchanged

## Quality bar

All gates green. Golden manifest APPEND-only confirmed by diff.
Commit: `feat(T8): add port-attachment golden fixtures`.
