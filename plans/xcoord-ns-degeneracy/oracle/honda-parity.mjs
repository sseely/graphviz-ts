import { readFileSync } from 'node:fs';
import { compareSvg } from '../../../test/golden/compare.js';
const port = readFileSync(process.argv[2],'utf8');
const oracle = readFileSync(process.argv[3],'utf8');
const cmp = compareSvg(port, oracle, 'deterministic');
if (cmp.pass) { console.log('VERDICT byte-match'); process.exit(0); }
const numeric = cmp.diffs.filter(d => d.delta !== undefined);
const structural = cmp.diffs.find(d => d.delta === undefined);
const maxDelta = numeric.reduce((mx,d)=>Math.max(mx,d.delta ?? 0),0);
console.log('VERDICT', structural ? 'diverged' : 'structural-match', 'maxDelta', maxDelta);
console.log('numericDiffs', numeric.length, 'structuralPresent', !!structural);
if (structural) console.log('structuralPath', structural.path);
