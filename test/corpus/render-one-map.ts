// SPDX-License-Identifier: EPL-2.0
//
// Isolation worker for the imagemap conformance walk (mission:
// map-conformance, T1 twin of render-one-xdot.ts).
//
// Renders ONE corpus input to BOTH `cmapx` and `imap` and writes them to
// stdout separated by sentinel lines. One subprocess per corpus item (not one
// per format), halving the walk's spawn overhead. The input is PARSED FRESH
// per format: `render()` (layout → render → freeLayout, src/render/public.ts)
// is NOT re-entrant on the same graph object — freeLayout leaves residual
// layout state that makes a second `ctx.layout(g)` throw (`undefined.par` in
// NS ranking on 165 corpus ids, `null.info` on 65) — proven by A/B probe
// (fresh parse per render: both OK; same g twice: second render throws). The
// fresh parse sidesteps the relayout hazard without touching src/ (the hazard
// itself is a library re-render issue, documented in the map-conformance
// triage as a follow-up). Runs as a spawned subprocess so the walker stays
// responsive — some inputs trigger synchronous infinite loops that cannot be
// interrupted in-process (mirrors render-one-xdot.ts / decisions.md AD-4). A
// hang here is killed by the parent's wall-clock timeout; a throw exits
// nonzero with the message on stderr behind a `__RENDER_ERROR__` sentinel.
//
//   tsx test/corpus/render-one-map.ts <inputPath> [engine=dot]
//
// stdout shape (both formats always attempted; a format-specific failure
// still lets the other format's output reach the walker):
//   __CMAPX__\n<cmapx text>__IMAP__\n<imap text>
//
// Node-only dev/test infra — never imported by src/index.ts.

import { readFileSync } from 'node:fs';
import { parse, render } from '../../src/index.js';
import type { OutputFormat, RenderOptions } from '../../src/render/public.js';
import type { EngineName } from '../../src/gvc/context.js';

export const CMAPX_SENTINEL = '__CMAPX__\n';
export const IMAP_SENTINEL = '__IMAP__\n';

/**
 * Decode a corpus input file the way native dot reads it — identical to
 * render-one.ts / render-one-xdot.ts (decodeDotInput).
 */
function decodeDotInput(buf: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return buf.toString('latin1');
  }
}

// map-walk.ts imports CMAPX_SENTINEL/IMAP_SENTINEL from this module (to keep
// the sentinel strings defined once) — an `isMain` guard is therefore
// required so that import alone does not execute the render body against the
// IMPORTER's process.argv (mirrors the isMain guards in map-walk.ts /
// xdot-walk.ts's own `main()` dispatch).
const isMain =
  process.argv[1] !== undefined && import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isMain) {
  const inputPath = process.argv[2];
  const engine = (process.argv[3] ?? 'dot') as EngineName;

  if (!inputPath) {
    process.stderr.write('usage: render-one-map <inputPath> [engine=dot]\n');
    process.exit(2);
  }

  try {
    const src = decodeDotInput(readFileSync(inputPath));
    const opts: RenderOptions = { engine };
    // Fresh parse per format — see the relayout-hazard note in the header.
    const cmapx = render(parse(src), 'cmapx' as OutputFormat, opts);
    const imap = render(parse(src), 'imap' as OutputFormat, opts);
    process.stdout.write(CMAPX_SENTINEL + cmapx + IMAP_SENTINEL + imap);
  } catch (err) {
    // Emit the thrown error on a sentinel line so the walker can distinguish
    // it from incidental warnings the port writes to stderr during rendering.
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`__RENDER_ERROR__ ${msg.split('\n')[0]}\n`);
    if (err instanceof Error && err.stack) process.stderr.write(err.stack + '\n');
    process.exit(1);
  }
}
