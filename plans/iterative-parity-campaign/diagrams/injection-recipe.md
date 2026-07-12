# Injection Recipe (POS_DUMP / POS_INJECT)

The mechanism this brief's attribution harness (T1) automates. Proven
manually on 2026-07-10 (`plans/decision-journal.md:86`, "injection A/B
verdicts" entry) and again as a precedent RCA in
`.agent-notes/twopi-radial-drift-rca.md` (its `Repro` section, lines
109–119). This doc is the reusable recipe; T1's harness scripts it.

## Native side — POS_DUMP (session-local, never committed)

1. In `~/git/graphviz/lib/neatogen/neatosplines.c`, find the real
   `spline_edges` entry point — NOT `spline_edges0`/`spline_edges1`.
   `spline_edges(graph_t *g)` is the outer wrapper (neatosplines.c:836)
   that still holds the RAW, pre-shift `ND_pos` (inches) — everything
   after it (`compute_bb` + the LL-offset subtraction two lines below)
   mutates `ND_pos` in place, and `ND_coord` (points) isn't populated
   until `neato_set_aspect` runs deeper inside `spline_edges0`. Dumping
   at the very top of `spline_edges`, before any of that, is what makes
   the dump match the port's `n.info.pos` (also pre-shift, also
   inches) — see `src/layout/neato/splines.ts`'s `splineEdgesShifted`,
   which calls the injection hook as its first statement for the same
   reason.
2. Add an env-gated dump, following the `getenv("...")`-per-call
   pattern already proven for a sibling dump (twopi's `TRI_DUMP`/
   `PRISM_DUMP`, per the RCA precedent). Exact patch applied and
   verified 2026-07-12 (T1):

   ```diff
   --- a/lib/neatogen/neatosplines.c
   +++ b/lib/neatogen/neatosplines.c
   @@ -838,6 +838,13 @@ void spline_edges(graph_t * g)
        node_t *n;
        pointf offset;
    
   +    if (getenv("GVTS_POS_DUMP")) {
   +	for (n = agfstnode(g); n; n = agnxtnode(g, n)) {
   +	    fprintf(stderr, "GVTS_POS %s %.17g %.17g\n",
   +		    agnameof(n), ND_pos(n)[0], ND_pos(n)[1]);
   +	}
   +    }
   +
        compute_bb(g);
        offset.x = PS2INCH(GD_bb(g).LL.x);
        offset.y = PS2INCH(GD_bb(g).LL.y);
   ```

   `%.17g` is required — it round-trips a `double` exactly (17
   significant digits), matching the precision the port's comparator
   needs to tell "drift" from "genuinely different mechanism" apart.
   `ND_pos` (inches), not `ND_coord` (points) — an earlier draft of
   this doc had the wrong field; `ND_coord` isn't even populated yet at
   this entry point on some paths, and using it would silently dump
   stale/zero values.
3. Rebuild only the affected plugin, not the whole tree:
   `cd ~/git/graphviz/build && make gvplugin_neato_layout -j4` (same
   target as the twopi RCA precedent). No manual copy step is needed —
   `/tmp/ghl/libgvplugin_neato_layout*.dylib` are symlinks straight into
   `build/plugin/neato_layout/`, so the rebuild is picked up in place.
4. Point `GVBINDIR` at the rebuilt plugin dir (the harness uses
   `/tmp/ghl`, matching the standing oracle convention — see
   `~/.claude/rules` environment notes and `CLAUDE.md`'s Verification
   section: oracle is always the native build with `GVBINDIR=/tmp/ghl`,
   never WASM, never homebrew dot).
5. One invocation captures BOTH sides: `GVTS_POS_DUMP=1
   GVBINDIR=/tmp/ghl dot -K<engine> -Txdot <corpus-item>.dot
   >oracle.xdot 2>dump.txt` — stdout is the final oracle xdot to
   compare against, stderr carries the `GVTS_POS <name> <x> <y>`
   lines. Verified end-to-end on `tests/graphs/a.gv` under `-Kneato`
   2026-07-12; example dump:
   ```
   GVTS_POS a -0.49451127648353577 0.073882661759853363
   GVTS_POS b 0.49451127648353577 -0.073882661759853363
   ```
6. **Revert the patch** before ending the session — it is session-local
   only, per D4. `git -C ~/git/graphviz diff` must show nothing before
   moving on; note the revert command actually used in the decision
   journal. T1 used: `git -C ~/git/graphviz checkout --
   lib/neatogen/neatosplines.c`, then rebuilt
   `gvplugin_neato_layout` again so the installed `/tmp/ghl` plugin
   matches the clean source (the dump is gated behind an env var that's
   never set outside this harness, but leaving the built artifact
   patched is untidy and unverifiable at a glance — rebuild clean).

### Known rebuild gotcha

A stale Homebrew library link can break the plugin rebuild without an
obvious error (the RCA precedent hit a removed `glib/2.88.1` — fixed
by symlinking the newer version already on disk: `ln -s
/opt/homebrew/Cellar/glib/2.88.2 /opt/homebrew/Cellar/glib/2.88.1` or
equivalent for whatever version drift is current). If a rebuild fails
in a way that looks unrelated to the patch itself, check for this
class of issue before assuming the patch is broken.

## Port side — POS_INJECT (committed, gated, inert in browser bundles)

`src/layout/neato/splines.ts`'s `injectOraclePositions(g)`, called as
the first statement of `splineEdgesShifted` (T1, landed 2026-07-12):

```ts
function injectOraclePositions(g: Graph): void {
  if (typeof process === 'undefined') return;
  const dumpPath = process.env?.['GVTS_POS_INJECT'];
  if (!dumpPath || typeof process.getBuiltinModule !== 'function') return;
  const fs = process.getBuiltinModule('node:fs');
  if (!fs) return;
  const text = fs.readFileSync(dumpPath, 'utf8');
  for (const line of text.split('\n')) {
    const m = /^GVTS_POS (\S+) (\S+) (\S+)/.exec(line);
    if (!m) continue;
    const n = g.nodes.get(m[1]!);
    if (n) n.info.pos = [Number(m[2]), Number(m[3])];
  }
}
```

Two guards, not one: `typeof process !== 'undefined'` (this file ships
in browser bundles; CLAUDE.md: "Browser-safe only... no `process.env`
in library code") AND `process.getBuiltinModule('node:fs')` instead of
a static `import ... from 'node:fs'`. This second guard is load-bearing
for a different reason than the first: the REAL production bundle
(`npm run build` → `esbuild src/index.ts --bundle --format=esm`, no
`--platform=node`) resolves imports at BUILD time, not runtime — a
static `node:fs` import breaks that build outright
(`Could not resolve "node:fs"`) regardless of any runtime `typeof
process` check, because esbuild never gets far enough to evaluate the
guard. `process.getBuiltinModule` is a plain method call on `process`
(not an import statement), so esbuild has nothing to statically
resolve; verified via a standalone esbuild probe (T1, 2026-07-12) that
a static `node:fs` import fails `--format=esm` bundling while the
`process.getBuiltinModule` form bundles clean. `getBuiltinModule` needs
Node 20.16+/22.3+ (`@types/node@26` here); the extra `typeof
process.getBuiltinModule === 'function'` check makes the hook inert
rather than throwing on an older Node — acceptable since only the
harness (which controls its own Node version) ever sets
`GVTS_POS_INJECT`.

The dump line format is intentionally the raw `GVTS_POS <name> <x>
<y>` wire format from the C patch above (not a re-serialized/cleaned
format) — a human following this recipe by hand can point
`GVTS_POS_INJECT` straight at a `2>dump.txt` capture with no
post-processing; any other stderr line (dot warnings, etc.) mixed into
the same capture is silently ignored by the regex.

## Oracle-hash guard (D4)

Before any injection run, the harness `sha1`s the oracle binary
(`DOT_BIN`, i.e. `~/git/graphviz/build/cmd/dot/dot` — NOT the
`gvplugin_neato_layout.dylib` the POS_DUMP patch actually lives in) and
compares it against the hash recorded in the FIRST line of the
resumable `attribution-<engine>.jsonl` (a `{"_meta":true,"oracleSha1":
...}` record written the first time a report is started). Resuming
against a jsonl whose recorded sha1 doesn't match the current `dot`
binary refuses outright (non-zero exit, no further lines appended) —
`--fresh` starts a new report (and a new recorded sha1) instead of
comparing. This is what would have caught the twopi/2470 stale-oracle
false regression (`.agent-notes/twopi-2470-rca.md`) before it cost
investigation time. Do not relax this guard to "warn and continue."

## When to escalate beyond pre-routing (`--stage`)

D1 reserves multi-stage / post-init / post-overlap injection for manual
diagnosis only — never bulk runs. If a bucket's pre-routing injection
does **not** clear it (like the circo/Almgren counter-example in the
2026-07-10 journal entry, where the real bug turned out to be a
missing `Plegal_arrangement` port, not FP drift), that is itself a
signal: the divergence originates downstream of node placement, and
the fix is architectural (port a missing routine), not FP-precision
related. Move that id to `named-open-mechanism` and diagnose normally
(diagnosis.md) rather than escalating the injection stage as a first
resort.
