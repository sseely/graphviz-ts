<!-- SPDX-License-Identifier: EPL-2.0 -->
# Contributing

## Quality gates (before you push)

Run the full set and keep them green:

```bash
npm run typecheck      # tsc --noEmit, must be clean
npm test               # vitest, all green
npm run build          # esbuild bundles + .d.ts
npm run docs:build     # copy-reports + TypeDoc + VitePress (if docs changed)
```

The `dot` engine is verified against the native C oracle; see
[`docs-site/conformance.md`](docs-site/conformance.md). Never edit `src/`
while a corpus sweep is running (it reads live source).

## Commit signing

The `main` branch ruleset requires **signed commits** (plus linear history
and PRs). Commits are signed with SSH, using a YubiKey (a FIDO `sk-ed25519`
key) for hardware-gated provenance.

Because a hardware key needs a physical touch per signature, auto-signing is
**off** — routine and automated/scripted commits stay touch-free. You sign
once, at the end, by collapsing your work into a single signed commit.

### One-time setup

```bash
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519_sk     # the FIDO handle
git config --global commit.gpgsign false                     # don't auto-sign
git config --global gpg.ssh.allowedSignersFile ~/.ssh/allowed_signers
```

On macOS, use Homebrew's OpenSSH for FIDO keys (Apple's lacks the provider):
`ssh-keygen`/`ssh-add` must resolve to `/opt/homebrew/bin`. Optionally blank
the handle passphrase for tap-only signing — safe for an sk key, since the
handle cannot sign without the physical key present:

```bash
ssh-keygen -p -f ~/.ssh/id_ed25519_sk    # set new passphrase = empty
```

Register the **public** key on GitHub as a **Signing Key** (not just an auth
key), or `required_signatures` will still fail:

```bash
gh auth refresh -h github.com -s admin:ssh_signing_key
gh ssh-key add ~/.ssh/id_ed25519_sk.pub --type signing --title "yubikey commit-signing"
```

### The commit-heavy workflow

Work freely on a branch (unsigned, automatable), then land one signed commit:

```bash
git switch -c feature/x
#   … many commits, by you or by tooling — no touches …

git switch main
git signmerge feature/x "feat: the whole thing, signed"   # one YubiKey tap
git push
```

`git signmerge <branch> [message]` is a global alias that squash-merges the
branch and creates a single signed commit (`git merge --squash` + `git commit
-S`). Omit the message to edit the pre-filled squash message. Run it from the
target branch.

For full ruleset compliance (it also wants `pull_request` + linear history),
push the signed commit to a branch and merge the PR with **"Rebase and
merge"** — that preserves *your* signature. "Squash and merge" makes GitHub
re-sign with its own key instead (also verified, but not your key).

### Verify a signature

```bash
git log --show-signature -1     # expect: Good "git" signature … ED25519-SK
```
