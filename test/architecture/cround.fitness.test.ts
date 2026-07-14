// SPDX-License-Identifier: EPL-2.0

/**
 * Fitness function: no `Math.round` in layout/label coordinate code.
 *
 * C rounds half **away from zero** — both libm `round()` (C99 7.12.9.6) and the
 * `ROUND(f) = ((f>=0)?(int)(f + .5):(int)(f - .5))` macro (`lib/common/arith.h:48`,
 * which `POINTS()` in `lib/common/geom.h:62` also expands to). JavaScript's
 * `Math.round` breaks ties toward +∞, so `Math.round(-4.5) === -4` where C gives
 * `-5`. They differ on EVERY exact negative half-integer.
 *
 * Layout coordinates are routinely negative (center-origin engines, cluster
 * walls left of an endpoint, port offsets from a node centre) and are often
 * exact integers or halves, so those ties are ordinary. A single missed call
 * site silently shifts a node, a port, or an entire packed component by 1pt.
 *
 * The deviation used to be re-implemented as five private copies (in
 * ortho-route, poly-pack, poly-place, edge-route-faithful and arm-pow), and
 * because it lived in five places rather than one, call sites kept being
 * missed — 22 of them, across compound edge clipping, packed component
 * placement, array packing, sameport, ratio scaling and xlabels. This test
 * exists so that the sixth private copy is never written and the 23rd site is
 * never missed: there is now exactly one `cround` (`src/common/arith.ts`), and
 * no `Math.round` may appear in the coordinate paths under `src/layout/` or
 * `src/label/`.
 *
 * If you are adding a site where the C genuinely rounds by some OTHER rule —
 * `(int)` truncation, `floor`, or printf `%.0f` (banker's rounding) — then
 * `Math.round` is wrong there too, but so is `cround`. Model the actual C rule
 * and, if `Math.round` really is the faithful choice, add the site to
 * ALLOWLIST below with a comment citing the C construct it mirrors.
 *
 * @see src/common/arith.ts:cround
 * @see lib/common/arith.h:48 (ROUND)
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

/** Directories whose coordinate math must mirror C's round(). */
const SCANNED = ['src/layout', 'src/label'];

/**
 * Sites deliberately left on `Math.round`, keyed `relativePath:line-content`.
 *
 * Each entry MUST cite the C construct it mirrors, proving C does not use
 * `round()`/`ROUND()` there. Currently empty: every rounding site under
 * `src/layout/` and `src/label/` mirrors a C `round()`/`ROUND()` and therefore
 * uses `cround`.
 *
 * (The known non-`round()` C rounding rules all live outside this scope:
 * `plugin/core/gvrender_core_map.c:44` prints coordinates with `%.0f`
 * (round-half-to-even) and `lib/common/colxlate.c:292` converts colour
 * channels with `(unsigned char)(R * 255)` (truncation).)
 */
const ALLOWLIST: Readonly<Record<string, string>> = {};

/** Recursively collect non-test .ts files under dir. */
function collectSources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSources(full, out);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

interface Offence {
  key: string;
  file: string;
  line: number;
  text: string;
}

function findOffences(): Offence[] {
  const offences: Offence[] = [];
  for (const scanned of SCANNED) {
    for (const file of collectSources(join(ROOT, scanned))) {
      const rel = relative(ROOT, file);
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((text, i) => {
        // Skip comments — prose may legitimately name Math.round to contrast it
        // with C's round().
        const code = text.trim();
        if (code.startsWith('//') || code.startsWith('*') || code.startsWith('/*')) return;
        if (!code.includes('Math.round(')) return;
        offences.push({ key: `${rel}:${i + 1}`, file: rel, line: i + 1, text: code });
      });
    }
  }
  return offences;
}

describe('fitness: C round() is half-away-from-zero — use cround, not Math.round', () => {
  it('has no unreviewed Math.round in src/layout or src/label', () => {
    const offences = findOffences().filter(o => !(o.key in ALLOWLIST));
    const message = offences
      .map(o => `  ${o.key}\n      ${o.text}`)
      .join('\n');
    expect(
      offences,
      offences.length === 0 ? '' :
        `\nMath.round() found in layout/label coordinate code:\n${message}\n\n` +
        `C rounds half AWAY FROM ZERO (round(-4.5) === -5); Math.round rounds\n` +
        `half toward +inf (Math.round(-4.5) === -4). They diverge by 1 on every\n` +
        `exact negative half-integer, and layout coordinates are freely negative.\n\n` +
        `Fix: import { cround } from 'src/common/arith.js' and use it, citing the\n` +
        `C round()/ROUND() call it mirrors. If the C at that site rounds by some\n` +
        `OTHER rule ((int) truncation, floor, printf %.0f), model that rule and\n` +
        `add the site to ALLOWLIST in this file with the C citation.\n`,
    ).toEqual([]);
  });

  it('keeps cround defined in exactly one place', () => {
    const defs: string[] = [];
    const CANONICAL = join('src', 'common', 'arith.ts');
    for (const scanned of [...SCANNED, 'src/common', 'src/ortho', 'src/render']) {
      for (const file of collectSources(join(ROOT, scanned))) {
        if (relative(ROOT, file) === CANONICAL) continue; // the one true home
        const src = readFileSync(file, 'utf8');
        // Any local re-implementation of half-away-from-zero rounding.
        if (/function\s+\w*[Rr]ound\w*\s*\([^)]*\)\s*:\s*number\s*\{[^}]*Math\.ceil\([^)]*-\s*0?\.5\)/s.test(src)) {
          defs.push(relative(ROOT, file));
        }
      }
    }
    expect(
      defs,
      `Half-away-from-zero rounding must be defined ONCE, in src/common/arith.ts.\n` +
      `Private re-implementations found in: ${defs.join(', ')}\n` +
      `Five such copies existed before, and because the deviation was scattered,\n` +
      `22 call sites were missed. Import cround from src/common/arith.js instead.`,
    ).toEqual([]);
  });
});
