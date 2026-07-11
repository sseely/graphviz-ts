// SPDX-License-Identifier: EPL-2.0
// Stamp package.json version as 0.1.<YYMMDDHH> (UTC).
//
// The intended scheme is 0.1.<YYMM>.<DDHH>, but npm requires strict semver
// (exactly major.minor.patch), so the two date parts are concatenated into
// the patch component: e.g. 2026-07-11 16:00 UTC -> 0.1.26071116.
// Ordering is preserved: later timestamps always compare greater.
import { readFileSync, writeFileSync } from 'node:fs';

const now = new Date();
const p = (n) => String(n).padStart(2, '0');
const patch =
  p(now.getUTCFullYear() % 100) +
  p(now.getUTCMonth() + 1) +
  p(now.getUTCDate()) +
  p(now.getUTCHours());
const version = `0.1.${Number(patch)}`;

const pkgPath = new URL('../package.json', import.meta.url);
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
pkg.version = version;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(version);
