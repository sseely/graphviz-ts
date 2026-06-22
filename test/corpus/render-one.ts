// SPDX-License-Identifier: EPL-2.0
//
// Isolation worker for the dot parity survey (mission: dot-corpus-harness, T2).
//
// Renders ONE corpus input to SVG and writes it to stdout. This runs as a
// spawned subprocess so the survey runner stays responsive: the port has no CLI
// and some inputs trigger synchronous infinite loops that cannot be interrupted
// in-process (decisions.md AD-2). A hang here is killed by the parent's
// wall-clock timeout; a throw exits nonzero with the message on stderr.
//
//   tsx test/corpus/render-one.ts <inputPath> <engine>
//
// Node-only dev/test infra — never imported by src/index.ts.

import { readFileSync } from 'node:fs';
import { renderSvg } from '../../src/index.js';

/**
 * Decode a corpus input file the way native dot reads it. dot scans raw bytes
 * with a default UTF-8 charset and, on invalid UTF-8, falls back to Latin-1 per
 * label (lib/common/utils.c:1218/1249 latin1ToUTF8). renderSvg takes an
 * already-decoded string, so the byte->string decode is the caller's job;
 * reading every file as UTF-8 mangled the Latin-1 corpus inputs (b56, b60,
 * Latin1) into U+FFFD before the parser saw them. Decode strict UTF-8, else
 * Latin-1.
 */
function decodeDotInput(buf: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return buf.toString('latin1');
  }
}

const inputPath = process.argv[2];
const engine = process.argv[3];

if (!inputPath || !engine) {
  process.stderr.write('usage: render-one <inputPath> <engine>\n');
  process.exit(2);
}

try {
  const svg = renderSvg(decodeDotInput(readFileSync(inputPath)), engine);
  process.stdout.write(svg);
} catch (err) {
  // Emit the thrown error on a sentinel line so the survey can distinguish it
  // from incidental warnings the port writes to stderr during rendering.
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`__RENDER_ERROR__ ${msg.split('\n')[0]}\n`);
  if (err instanceof Error && err.stack) process.stderr.write(err.stack + '\n');
  process.exit(1);
}
