# Changesets

This directory holds [Changesets](https://github.com/changesets/changesets) —
semver + changelog management for `@knowvah/dot-engine`.

When you make a change worth releasing, run `npm run changeset`, pick the bump
type (patch / minor / major), and describe it. The entry is committed alongside
your change. On merge to `main`, the Release workflow opens/updates a "Version
Packages" PR that applies the pending changesets (bumping the version + writing
`CHANGELOG.md`); merging **that** PR publishes to npm via OIDC.
