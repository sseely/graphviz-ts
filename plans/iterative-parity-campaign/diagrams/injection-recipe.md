# Injection Recipe (POS_DUMP / POS_INJECT)

The mechanism this brief's attribution harness (T1) automates. Proven
manually on 2026-07-10 (`plans/decision-journal.md:86`, "injection A/B
verdicts" entry) and again as a precedent RCA in
`.agent-notes/twopi-radial-drift-rca.md` (its `Repro` section, lines
109–119). This doc is the reusable recipe; T1's harness scripts it.

## Native side — POS_DUMP (session-local, never committed)

1. In `~/git/graphviz/lib/neatogen`, find the `spline_edges` entry
   point (the D1-designated pre-routing injection stage).
2. Add an env-gated dump, following the `getenv("...")`-per-call
   pattern already proven for a sibling dump (twopi's `TRI_DUMP`/
   `PRISM_DUMP`, per the RCA precedent):

   ```c
   if (getenv("GVTS_POS_DUMP")) {
     for (int i = 0; i < agnnodes(g); i++) {
       Agnode_t *n = ...; /* the node being dumped */
       fprintf(stderr, "GVTS_POS %s %.17g %.17g\n",
               agnameof(n), ND_coord(n).x, ND_coord(n).y);
     }
   }
   ```

   `%.17g` is required — it round-trips a `double` exactly (17
   significant digits), matching the precision the port's comparator
   needs to tell "drift" from "genuinely different mechanism" apart.
3. Rebuild only the affected plugin, not the whole tree:
   `gvplugin_neato_layout` (same target as the twopi RCA precedent).
4. Point `GVBINDIR` at the rebuilt plugin dir (the harness uses
   `/tmp/ghl`, matching the standing oracle convention — see
   `~/.claude/rules` environment notes and `CLAUDE.md`'s Verification
   section: oracle is always the native build with `GVBINDIR=/tmp/ghl`,
   never WASM, never homebrew dot).
5. Run: `GVTS_POS_DUMP=1 GVBINDIR=/tmp/ghl dot -K<engine> -Txdot
   <corpus-item>.dot 2>dump.txt` — positions land on stderr, parse the
   `GVTS_POS` lines.
6. **Revert the patch** before ending the session — it is session-local
   only, per D4. `git -C ~/git/graphviz diff` must show nothing before
   moving on; note the revert command actually used in the decision
   journal.

### Known rebuild gotcha

A stale Homebrew library link can break the plugin rebuild without an
obvious error (the RCA precedent hit a removed `glib/2.88.1` — fixed
by symlinking the newer version already on disk: `ln -s
/opt/homebrew/Cellar/glib/2.88.2 /opt/homebrew/Cellar/glib/2.88.1` or
equivalent for whatever version drift is current). If a rebuild fails
in a way that looks unrelated to the patch itself, check for this
class of issue before assuming the patch is broken.

## Port side — POS_INJECT (committed, gated, inert in browser bundles)

`src/layout/neato/splines.ts` gets a small hook (T1 writes this):

```ts
if (typeof process !== 'undefined' && process.env?.GVTS_POS_INJECT) {
  // read the dump file named by GVTS_POS_INJECT, overwrite n.info.pos
  // for matching node names before this module's own routing runs.
}
```

The `typeof process !== 'undefined'` guard is required — this file
ships in browser bundles (CLAUDE.md: "Browser-safe only... no
`process.env` in library code"). The guard keeps the hook a no-op
outside Node/test contexts; the env var itself never gets read in a
browser build.

## Oracle-hash guard (D4)

Before any injection run, the harness `sha1`s the oracle binary in use
and compares it against the hash recorded with the cached dump set for
that id. A mismatch refuses the run outright — this is what would have
caught the twopi/2470 stale-oracle false regression
(`.agent-notes/twopi-2470-rca.md`) before it cost investigation time.
Do not relax this guard to "warn and continue."

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
