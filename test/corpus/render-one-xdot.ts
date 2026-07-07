// SPDX-License-Identifier: EPL-2.0
//
// Isolation worker for the xdot conformance walk (mission: xdot-conformance, T1).
//
// Renders ONE corpus input to xdot via the port and writes it to stdout. Mirrors
// test/corpus/render-one.ts (the SVG survey worker) exactly, differing only in
// the target format: `render(g, 'xdot')` instead of `renderSvg(...)`. It runs as
// a spawned subprocess so the walker stays responsive — the port has no CLI and
// some inputs trigger synchronous infinite loops that cannot be interrupted
// in-process (decisions.md AD-4 reuses survey.ts's spawn model). A hang here is
// killed by the parent's wall-clock timeout; a throw exits nonzero with the
// message on stderr behind a `__RENDER_ERROR__` sentinel.
//
//   tsx test/corpus/render-one-xdot.ts <inputPath> [engine=dot]
//
// Node-only dev/test infra — never imported by src/index.ts.

import { readFileSync } from 'node:fs';
import { parse, render } from '../../src/index.js';
import type { OutputFormat, RenderOptions } from '../../src/render/public.js';
import type { EngineName } from '../../src/gvc/context.js';

/**
 * Decode a corpus input file the way native dot reads it — identical to
 * render-one.ts (decodeDotInput). dot scans raw bytes with a default UTF-8
 * charset and, on invalid UTF-8, falls back to Latin-1 per label
 * (lib/common/utils.c:1218/1249 latin1ToUTF8). Reading every file as UTF-8
 * mangles the Latin-1 corpus inputs (b56, b60, Latin1) into U+FFFD before the
 * parser sees them. Decode strict UTF-8, else Latin-1.
 */
function decodeDotInput(buf: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return buf.toString('latin1');
  }
}

const inputPath = process.argv[2];
const engine = (process.argv[3] ?? 'dot') as EngineName;

if (!inputPath) {
  process.stderr.write('usage: render-one-xdot <inputPath> [engine=dot]\n');
  process.exit(2);
}

try {
  const g = parse(decodeDotInput(readFileSync(inputPath)));
  const opts: RenderOptions = { engine };
  const xdot = render(g, 'xdot' as OutputFormat, opts);
  process.stdout.write(xdot);
} catch (err) {
  // Emit the thrown error on a sentinel line so the walker can distinguish it
  // from incidental warnings the port writes to stderr during rendering.
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`__RENDER_ERROR__ ${msg.split('\n')[0]}\n`);
  if (err instanceof Error && err.stack) process.stderr.write(err.stack + '\n');
  process.exit(1);
}
