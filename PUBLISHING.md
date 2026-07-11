<!-- SPDX-License-Identifier: EPL-2.0 -->

# Publishing graphviz-ts to npmjs.org (manual)

The package name `graphviz-ts` is unclaimed on the npm registry (verified
2026-07-11). Publishing is a deliberate, manual act — nothing in CI publishes.

## Versioning scheme

Intended scheme: `0.1.<YYMM>.<DDHH>`. npm enforces strict semver (exactly
`major.minor.patch`), which rejects four-part versions, so the two date parts
are concatenated into the patch component:

```
0.1.<YYMMDDHH>     e.g. 2026-07-11 16:00 UTC  →  0.1.26071116
```

Ordering is identical to the intended scheme (later timestamp ⇒ greater
version). `npm run version:stamp` computes it from the current UTC time and
rewrites `package.json`.

## What gets published

`package.json` `files` whitelist: `dist/` (esbuild ESM bundles + `.d.ts`
declarations) and `src/` (excluding tests) for source-map/debugging use.
`README.md` and `LICENSE` (EPL-2.0) are always included by npm. Entry points:

| import | bundle | types |
|---|---|---|
| `graphviz-ts` | `dist/index.js` | `dist/index.d.ts` |
| `graphviz-ts/api` | `dist/api.js` | `dist/api/index.d.ts` |
| `graphviz-ts/render` | `dist/render.js` | `dist/render/index.d.ts` |

`canvas` is an **optional** peer dependency (text measurement defaults to the
built-in Estimate measurer; no native deps required).

## Checklist

```sh
# 0. clean tree on the branch you mean to publish
git status

# 1. gates (the corpus sweeps are the real bar; at minimum:)
npm run typecheck && npm test

# 2. stamp the version (prints it)
npm run version:stamp

# 3. build + inspect exactly what will ship (no upload)
npm run publish:check          # typecheck + build + `npm pack --dry-run`

# 4. log in (once per machine) and publish
npm login
npm publish                    # prepublishOnly re-runs typecheck + build

# 5. tag and record
git add package.json && git commit -m "chore(release): v$(jq -r .version package.json)"
git tag "v$(jq -r .version package.json)" && git push origin --tags
```

Sanity check after publish: `npm view graphviz-ts version` and a scratch
`npm i graphviz-ts` + `import { parse, render } from 'graphviz-ts'` smoke test.

## Troubleshooting

**`403 Forbidden … Two-factor authentication or granular access token with
bypass 2fa enabled is required to publish packages.`** — registry-wide npm
policy; fix on npmjs.com (not in this repo):

- *Preferred (interactive publishing):* Account Settings → Two-Factor
  Authentication → enable ("Authorization and writes"). Then `npm publish`
  prompts for the OTP, or pass `npm publish --otp=<code>`.
- *Alternative (scripted):* Access Tokens → Generate New Token → **Granular**,
  packages Read/Write, with **Bypass two-factor authentication** checked.
  Export it per-shell (`export NPM_TOKEN=…`) and add
  `//registry.npmjs.org/:_authToken=${NPM_TOKEN}` to `~/.npmrc`. Never commit
  a token.

## Notes

- `prepublishOnly` runs `typecheck + build` automatically inside `npm publish`,
  so a stale `dist/` cannot ship.
- The package is unscoped and public; no `--access` flag needed.
- Do not publish from a tree with uncommitted `src/` changes — the sweep
  dashboards (`test/corpus/PARITY*.md`) describe the committed tree only.
