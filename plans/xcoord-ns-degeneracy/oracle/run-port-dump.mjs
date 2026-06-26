// SPDX-License-Identifier: EPL-2.0
// TEMPORARY (mission xcoord-ns-degeneracy T2): drive honda through the port with
// the _xdump sink enabled, write the 4-stage dump to port-dump.txt.
//   tsx plans/xcoord-ns-degeneracy/oracle/run-port-dump.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { renderSvg } from '../../../src/index.js';

globalThis.__XDUMP = true;
globalThis.__XDUMP_LINES = [];

const input = join(homedir(), 'git/graphviz/tests/graphs/honda-tokoro.gv');
const dot = readFileSync(input, 'utf8');
const svg = renderSvg(dot, 'dot');
if (!svg.includes('</svg>')) throw new Error('port render produced no SVG');

const out = new URL('./port-dump.txt', import.meta.url);
writeFileSync(out, globalThis.__XDUMP_LINES.join('\n') + '\n');
console.log(`port-dump lines: ${globalThis.__XDUMP_LINES.length}`);
