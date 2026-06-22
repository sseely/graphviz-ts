<!-- SPDX-License-Identifier: EPL-2.0 -->

# Technology Health

Versions cross-checked against [endoflife.date](https://endoflife.date/nodejs),
the Node.js release schedule, and the TypeScript release history. CVE search via
NVD/OSV. Date of check: 2026-06-22.

| Repo | Component | Version | EOL Date | CVEs (High+) | Action |
|------|-----------|---------|----------|--------------|--------|
| graphviz-ts | Node.js (Volta pin) | 26.3.1 | 2029-04-30 | None known at 26.3.1 | OK |
| graphviz-ts | TypeScript | ^5.4.0 | n/a (tooling) | None | Update available |
| graphviz-ts | esbuild | ^0.28.1 | n/a | None | OK |
| graphviz-ts | vitest | ^4.1.9 | n/a | None | OK |
| graphviz-ts | peggy | ^4.0.0 | n/a | None | OK |
| plantuml-js | TypeScript | ^5.4.0 | n/a | None | Update available |
| plantuml-js | Vite | ^5.0.0 | n/a | check OSV for 5.x | Update available |
| plantuml-js | katex | ^0.16.45 | n/a | None known | OK |
| graphviz (C) | Graphviz | 15.0.0 | n/a (upstream spec) | n/a | OK (reference only) |
| plantuml | Java/JVM | — | depends on JDK | n/a | reference only |

## Notes

- **Node.js 26.3.1** — Current release line (shipped 2026-05-05), transitions to
  Active LTS 2026-10-28, EOL 2029-04-30. Fully supported; no action required.
  It is the last line under the old release model (Node 27 starts the
  one-major-per-year, always-LTS model).
  ([release schedule](https://nodejs.org/en/blog/announcements/evolving-the-nodejs-release-schedule),
  [endoflife.date](https://endoflife.date/nodejs))
- **TypeScript `^5.4.0`** — The `^5.4.0` floor predates TypeScript 6.0 (released
  2026-03-23, current stable 6.0.3) and the 7.0 RC (Go-native, ~10× faster).
  No security exposure, but the project is two majors behind. Upgrading to 6.x
  is low-risk (40–60% faster incremental builds); 7.0 will remove flags
  deprecated in 6.0, so plan the bump deliberately.
  ([TypeScript releases](https://github.com/microsoft/typescript/releases))
- **esbuild / vitest / peggy** — Recent versions, no known High+ CVEs. OK.
- **Vite 5.x (plantuml-js)** — Vite 5 is a generation behind current; check
  [osv.dev](https://osv.dev) for the exact patch level before the next release.
- **graphviz (C) and plantuml (Java)** are reference sources, not shipped
  dependencies of graphviz-ts, so their version health does not affect the
  runtime/security posture of the published library. The C checkout at tag
  15.0.0 simply pins the spec being ported.

## Action summary

- `OK`: Node 26.3.1, esbuild, vitest, peggy, katex.
- `Update available` (non-urgent, no CVE): TypeScript 5.4 → 6.x across both TS
  repos; Vite 5 → current in plantuml-js.
- No `EOL — upgrade required` or `CVE — patch required` items found.
