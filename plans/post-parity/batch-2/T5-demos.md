# T5 — demos folder: live in-browser side-by-side

## Context

The library targets browsers (CLAUDE.md: no Node-only APIs in src/).
Scott wants a demos page: for every golden test, the C graphviz SVG
(from the stored ref) next to the graphviz-ts SVG. decisions.md D1: the
TS side renders LIVE in the browser — this is both a demo and a proof of
the browser target. Must open from `file://` (no fetch, no server).

## Task

1. `demos/build.ts` — a Node build script (dev-time only, Node APIs fine
   here) that:
   - Reads manifest.json; for each entry loads the .dot input text and
     the C ref SVG text
   - Emits `demos/data.generated.js` (an ES module exporting the array
     of {id, engine, description, dot, refSvg}); gitignore the generated
     file or commit it — executor's choice, journal it
   - Bundles `demos/main.ts` + the library with esbuild
     (`--bundle --format=iife --outfile=demos/demo.generated.js`,
     browser platform — build FAILS if any Node-only API leaks into src/)
2. `demos/main.ts` — imports renderSvg from ../src/index.ts and the data
   module; on load, for each entry renders the TS SVG and injects both
   sides into the DOM. Group by engine with an engine nav; per entry show
   id, description, a collapsible <pre> of the .dot source, C SVG left,
   TS SVG right, labeled.
3. `demos/index.html` — static shell that loads demo.generated.js. Plain
   CSS, no framework, no CDN (file:// + offline).
4. `demos/README.md` — how to build (`npm run demo`) and open.
5. package.json: `"demo": "node --experimental-strip-types demos/build.ts"`
   or esbuild-bundle the build script first — executor's choice; must
   work with the repo's installed toolchain only (no new deps).
6. Render check: after building, verify via node that demo.generated.js
   contains no `require(` and the page's TS-side render of dot-simple-box
   equals renderSvg's output (string compare in a small node assertion in
   build.ts --check mode or a vitest test under demos/ excluded from
   coverage).

## Write-set

demos/* (all new), package.json (scripts block only — T1 already landed)

## Read-set

test/golden/manifest.json; src/index.ts exports; decisions.md#D1;
vitest.config.ts include patterns (keep demos/ out of the test glob
unless adding the check test deliberately)

## Acceptance criteria

- Given `npm run demo`, when the build completes, then demos/index.html
  + generated JS exist and the build exits 0
- Given demos/index.html opened from file://, then every manifest entry
  shows C SVG and TS SVG side-by-side, grouped by engine (manual check
  by Scott; automated proxy: the string-compare render check passes)
- Given the esbuild browser-platform bundle, then it builds with zero
  Node shims (build fails otherwise — that IS the check)
- Given `npx vitest run`, then suite unchanged-or-grown and green

## Observability: N/A. Rollback: Reversible.

## Quality bar

npx tsc --noEmit clean (demos/*.ts included via tsconfig or a demos
tsconfig — keep main repo typecheck green either way); npx vitest run
green. Commit: `feat(T5): add live side-by-side demos page`
