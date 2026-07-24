<!-- SPDX-License-Identifier: EPL-2.0 -->

# Publishing @knowvah/dot-engine

Releases are automated with **semantic-release + npm Trusted Publishing (OIDC)** —
no long-lived tokens. Day to day you never run `npm publish`: merge a PR whose
title is a Conventional Commit (`feat:` / `fix:` / `feat!:`) and GitHub Actions
derives the version, publishes, tags, and creates the GitHub Release. See the
[Releasing section of CONTRIBUTING](CONTRIBUTING.md#releasing-semantic-release).

The one-time trusted-publisher setup below is already done for
`@knowvah/dot-engine`; it's kept here as reference (and for future packages).

## One-time trusted-publisher setup (reference — already done)

### 1. Create the `@knowvah` npm org

npmjs.com → **Add Organization** → `knowvah` (the free tier is fine). This owns
the `@knowvah/*` scope so the scoped packages can be published.

### 2. Do the first publish manually (to create the package)

Trusted publishing is configured on a package's *Settings* page, which requires
the package to **already exist** on npm. So the very first
`@knowvah/dot-engine` publish is manual, done interactively with your 2FA:

```sh
git checkout main && git pull        # publish from the released tree
npm run publish:check                # typecheck + build + `npm pack --dry-run`
npm login                            # once per machine
npm publish                          # publishes 0.1.0; prompts for your 2FA OTP
```

`prepublishOnly` re-runs typecheck + build, so a stale `dist/` can't ship.
`publishConfig.access` is already `public` — no `--access` flag needed.

### 3. Configure the trusted publisher (so CI publishes from now on)

npmjs.com → **@knowvah/dot-engine → Settings → Trusted Publishers → Add →
GitHub Actions**:

| Field | Value |
| --- | --- |
| Organization or user | `knowvah` |
| Repository | `dot-engine` |
| Workflow filename | `release.yml` |
| Environment | `release` |

After this, you never publish `@knowvah/dot-engine` by hand again.

### 4. Deprecate the old `graphviz-ts` package

The predecessor `graphviz-ts` (unscoped, date-stamp versions up to
`0.1.26072117`) is superseded. Point installers at the new name:

```sh
npm deprecate graphviz-ts "renamed to @knowvah/dot-engine"
```

### 5. (Optional) gate publishes behind an approval

The `release` environment is auto-created on the first workflow run with no
protection. To require a manual approval before each publish, add reviewers:
GitHub → repo **Settings → Environments → `release` → Required reviewers**.

> The sibling **`@knowvah/dot-plugins`** monorepo publishes the same way. Repeat
> steps 1–3 there for each package (`@knowvah/dot-core`,
> `@knowvah/dot-markdown-it`, `@knowvah/vitepress-plugin-dot`,
> `@knowvah/eleventy-plugin-dot`, `@knowvah/docusaurus-plugin-dot`,
> `@knowvah/dot-react`), with repository `dot-plugins`, workflow `release.yml`,
> environment `release`.

## Day-to-day releasing (after the bootstrap)

1. Open a PR whose **title is a Conventional Commit** — `fix:` (patch),
   `feat:` (minor), `feat!:` / `BREAKING CHANGE:` (major). PRs are squash-merged,
   so that title is the commit semantic-release reads. `docs:`/`chore:`/`ci:`
   titles publish nothing.
2. Merge it. The **Release** workflow runs semantic-release, which — if the
   commit is releasable — publishes to npm via OIDC (with provenance), pushes the
   `v<version>` tag, and creates a GitHub Release with the notes.

No `NPM_TOKEN`, no `npm publish`, no version bumping, no changeset files. The
version lives in the git tag / npm / GitHub Release (`package.json` stays
`0.0.0-development`).

## What gets published

`package.json` `files`: `dist/` (esbuild ESM bundles + `.d.ts`) and `src/`
(excluding tests). `README.md` + `LICENSE` (EPL-2.0) are always included by npm.
Entry points:

| import | bundle | types |
| --- | --- | --- |
| `@knowvah/dot-engine` | `dist/index.js` | `dist/index.d.ts` |
| `@knowvah/dot-engine/api` | `dist/api.js` | `dist/api/index.d.ts` |
| `@knowvah/dot-engine/render` | `dist/render.js` | `dist/render/index.d.ts` |

`canvas` is an **optional** peer dependency (text measurement defaults to the
built-in Estimate measurer; no native deps required).

## Removing a published version

- Within **72 h** of publishing: `npm unpublish @knowvah/dot-engine@<version>`.
- A version number can **never be reused** — cut a new one via a new releasable commit.
- After 72 h, prefer `npm deprecate @knowvah/dot-engine@<version> "<message>"`
  (keeps it installable, warns on install).

## Notes

- Trusted publishing requires npm **≥ 11.5.1** (the workflow upgrades it);
  provenance is automatic — no `--provenance` flag.
- npm is retiring 2FA-bypass **token** publishing (sensitive-op limits ~Aug 2026;
  no direct token publish ~Jan 2027), which is why CI uses OIDC rather than a
  long-lived publish token. Interactive `npm publish` with 2FA (step 2) stays
  supported for the one-time bootstrap.
