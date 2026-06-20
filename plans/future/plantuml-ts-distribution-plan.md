# PlantUML-TS Distribution Plan

Captured planning notes for distributing the pure-TypeScript, graphviz-faithful
PlantUML rendering engine across markdown/diagram surfaces. Work targeted to
start in ~1–2 weeks.

## Core premise

One engine, many thin adapters. The hard part — the faithful, bit-exact-to-C
graphviz layout engine plus the PlantUML parser — is done and **shared**. Each
distribution surface below is a relatively thin adapter around that one engine.
The engine's defining advantage everywhere: **pure TypeScript, no Java, no
native binary, no WASM**. That property is what makes it better than incumbents
in every surface, because the existing options all shell out to a PlantUML
server or a local Java install.

The engine produces **SVG**. Every surface's render step ultimately injects that
SVG into a webview, an embedded browser, or a committed file. The rendering half
is identical across surfaces; only the *packaging/adapter* half differs.

### Two adapter families (most surfaces collapse into these)

Nearly every target is one of two adapter shapes. Build each shape *slightly
general* so it serves its whole family rather than one target — that's the real
leverage. "Putting it in more places" is mostly NOT "build N new things"; it's
"each of the two adapters unlocks a family."

- **Pre-render family (build-time → SVG):** run the engine ahead of display,
  emit SVG, let any image-displaying surface show it. Members: GitHub Action,
  remark/rehype plugin (→ Docusaurus, VitePress, Astro, any unified pipeline),
  MkDocs-style build steps, GitLab/self-hosted via committed SVG, standalone CLI.
  One pre-render core, many consumers. No per-reader install. Not live.
- **Live-webview family (in-editor → SVG into a preview pane):** catch the
  fenced block, render in-process, inject SVG into the editor's preview
  webview/embedded browser. Members: VS Code, Obsidian, JetBrains, any editor
  with a webview markdown preview. Live edit-preview. Per-tool packaging differs.
- **Browser-extension** is a third, distinct shape (client-side render injected
  into *someone else's already-rendered page* — see Surface 7). It's how you
  reach server-rendered surfaces you can't plug into (github.com, GitLab.com).

---

## Surface 1 — GitHub Action (ship FIRST)

**Why first:** thinnest adapter (no plugin API to learn — "run the engine in CI,
write a file"), widest display reach, directly answers "get it on GitHub" (which
the plugins structurally cannot — see note below), and the fastest way to get
the engine used by strangers and generating real-world bug reports.

**Key fact:** GitHub.com does NOT expose a server-side plugin API for markdown
rendering. You cannot ship a plugin that makes github.com render PlantUML.
Mermaid is on GitHub because GitHub *themselves* added it natively. So the only
paths to "diagrams on GitHub" are (a) a browser extension that renders
client-side for installed users, or (b) **pre-render to SVG and commit the
image** — which is what the Action does.

**How it works:** Action runs in CI on push/PR → finds `.puml` files (or
`plantuml`/`puml` fenced blocks in markdown) → runs the TS engine → produces
SVGs → commits/updates them in the repo (or posts them). GitHub then displays
plain images it already knows how to render. Works on github.com, GitLab, the
npm README, docs sites — **anywhere images display**. Universal reach via the
universal-image property.

**Why it showcases the engine:** lightweight Node action, `npm install` + run,
no "install graphviz" step, no JRE, no PlantUML server. Contrast the
`setup-graphviz` Action (which exists solely to install the native binary) —
this Action has none of that friction.

**Two modes:**
- **Commit-back mode:** render SVGs and commit them into the repo for README/docs
  diagrams. Deterministic, reviewable in the diff.
- **PR-comment / check-run mode:** render on PRs and post diagrams as a PR
  comment or check-run, so reviewers see output *without* committing generated
  files. Avoids the generated-files-in-VCS objection. Different use case (review)
  but same engine.

**Implementation sharp edges:**
- Needs write permissions for commit-back.
- **Must gate against infinite CI loops** — the Action's own commit must not
  re-trigger the Action. Standard solved problem; gate to skip self-commits.
- Decide where SVGs live and how markdown references them.

**Limit:** not live. Reader sees an SVG as fresh as the last CI run. Fine — often
better — for README/docs diagrams that change rarely. Live edit-preview is the
plugins' job (below), not the Action's.

---

## Surface 2 — VS Code plugin (cleanest live-authoring target)

**Why strong:** real, well-supported plugin model. VS Code's built-in markdown
preview is explicitly extensible via the `markdown.markdownItPlugins`
contribution point. The engine is *exactly* the right shape for this — a
markdown-it plugin that catches `plantuml`/`puml` fenced code blocks, runs the
TS layout engine in-process, and injects the SVG into the preview.

**Why better than incumbents:** existing VS Code PlantUML extensions mostly
shell out to a PlantUML server or a local Java install. A pure-TS, in-process
renderer needs **no external dependency to configure** — strictly better on the
no-setup axis.

**Render mechanism:** VS Code markdown preview renders HTML/SVG in a webview.
Core integration = catch the code block → call the TS engine → inject SVG into
the preview DOM. Native via the markdown-it contribution point.

**TODO when starting:** look up the exact `markdownItPlugins` contribution-point
API and how the existing Mermaid VS Code extensions wire in, as the concrete
template.

---

## Surface 3 — JetBrains plugin (achievable, heavier)

**Why heavier:** JetBrains' plugin platform is **JVM-based (Kotlin/Java)** and
the engine is TypeScript, so there's a language-boundary layer to build that VS
Code doesn't require — either embed a JS runtime in the plugin or bridge through
the JCEF (Chromium-embedded) component their markdown preview already uses.

**Saving grace:** JetBrains' markdown preview renders via an **embedded browser**,
which is good — the TS/SVG can run in that browser context. The *rendering* half
is the same "SVG into a webview" as everywhere; only the **plugin wrapper** is
JVM, and that wrapper around the TS engine is the specific complexity to scope.

**Sequencing:** do after VS Code. Same live-authoring use case, more plumbing.

---

## Surface 5 — remark/rehype plugin (HIGHEST ecosystem leverage)

**Family:** pre-render. Possibly the single highest-leverage surface — consider
*ahead of the IDE plugins* on leverage grounds.

**Why:** the `unified` ecosystem (`remark` for markdown, `rehype` for HTML) is
the shared substrate under a huge swath of JS docs/blog tooling — **Docusaurus,
VitePress, Astro, Next.js MDX, Gatsby, and any custom unified pipeline** all
consume remark/rehype plugins. A single `remark-plantuml` (or rehype) plugin
that renders PlantUML blocks to SVG at build time reaches *all of them at once*.
Build one, serve an ecosystem.

**Why our engine wins here specifically:** existing build-time PlantUML plugins
require installing graphviz and/or Java in the build environment (CI, Vercel,
Netlify). A pure-TS plugin with **zero system dependencies** is a strictly
better build-time plugin — no `setup-graphviz`, no JRE in the build image, works
in serverless/edge build environments where installing native binaries is
painful or impossible. The no-Java/no-WASM property matters *most* in
constrained build environments.

**Shape:** same as the GitHub Action (pre-render → SVG), just plugged into the
docs-build pipeline instead of CI. Catch the `plantuml` node in the mdast/hast
tree → run the engine → replace with inline SVG. Reuses the pre-render core.

---

## Surface 6 — Obsidian plugin (strong live-authoring fit)

**Family:** live-webview. High fit — bump near VS Code in priority, arguably
above JetBrains.

**Why:** Obsidian is a large, fast-growing local-first PKM app whose users are
*exactly* the technical-diagram-drawing demographic, with a thriving
community-plugin ecosystem and a plugin API built for this.

**Why our engine is philosophically aligned (the key point):** existing Obsidian
PlantUML plugins **shell out to a PlantUML server or require local Java** —
which Obsidian users actively dislike, because Obsidian's entire ethos is
**local-first, no-server, your-files-on-your-disk**. A pure-TS renderer that
needs no server and no Java is aligned with Obsidian's values in a way the
current heavy options are not. This is a case where the no-dependency property
isn't just convenient — it matches the platform's identity, which makes adoption
easier and the pitch sharper.

**Shape:** live-webview family — register a code-block processor for `plantuml`
blocks, render in-process, inject SVG into the preview pane. Same shape as VS
Code; Obsidian-specific plugin API.

---

## Surface 7 — Browser extension (reaches server-rendered surfaces)

**Family:** its own shape — client-side render injected into pages *you can't
plug into server-side*. This is the answer to "how do I render on github.com /
gitlab.com," which neither plugins nor (live) Actions solve.

**How it works:** a Chrome/Firefox content script scans the already-rendered page
for `plantuml` fenced blocks, renders each with the TS engine client-side, and
replaces/augments the block with the SVG inline. Reaches GitHub, GitLab,
Bitbucket, gists, wikis, issues/PRs — anywhere the block appears in a page the
extension is scoped to.

**The decisive advantage vs. the incumbent** (`plantuml/plantuml-for-github`,
see Prior Art): that extension uses TeaVM-transpiled-Java PlantUML +
**graphviz-WASM**, which forces it to **relax the Manifest V3 CSP** with
`'wasm-unsafe-eval'` to instantiate the WASM module — a concession it must
document and defend to extension-store reviewers. **Our pure-TS engine
instantiates no WASM, so it needs no CSP relaxation** — a cleaner,
more-defensible, lower-permission extension on the exact axis the incumbent
flags as its weakest. Cleaner security story + lighter runtime + no transpiled
Java.

**UX to match/beat (steal this):** the incumbent offers a **toggle between the
rendered diagram and the original source** (source view uses the host's own
syntax highlighting, so it looks native). That's a nice pattern users will
expect — match or beat it.

**Tradeoff:** per-user install (only renders for people who installed it), same
as any extension. Contrast the Action/pre-render path, which needs no per-reader
install but isn't live. Consider both: **extension for live client-side render**
on server-rendered platforms; **Action/pre-render for install-free universal
display**. They're complementary, not either/or.

**Distribution note:** browser extensions go through Chrome Web Store / Firefox
Add-ons review. The zero-permissions, no-WASM, no-CSP-relaxation profile makes
that review *easier* than the incumbent's — a real advantage at submission.

---

## Surface 4 — Jira plugin (the commercial surface)

**Product shape:** charge for the *integration/config convenience*, not for
closed code. The libraries (graphviz-TS, PlantUML-TS) stay public. The Jira
plugin is the separate consuming product — "the ability to install the thing in
Jira and have it just work." Target price point explored: ~$100/year; 1,000
customers = a happy outcome.

### Licensing — the load-bearing open question

This is the part that needs **actual verification before building**, not
assumption. Status as of capture: still unverified — the single most important
fact to nail down.

- **graphviz-TS port is EPL** (inherited from graphviz, carried forward). EPL is
  **file-level copyleft** and explicitly permits commercial use. A *separate*
  product that consumes EPL libraries (without modifying the EPL files) keeps the
  consuming code under whatever license you want. The open release of the port
  satisfies EPL's source-availability obligation by construction.
- **PlantUML is GPL** (with some LGPL/other components + a commercial-license
  option). A faithful TS port of PlantUML is a **derivative of GPL code**, so the
  PlantUML-TS port is most likely **forced GPL** — you do NOT get to pick its
  license the way you (correctly) picked EPL for the graphviz port by
  inheritance. The upstream license picks for you.
- **GPL is derivative-work copyleft, not file-level.** Whether a separate product
  that *links/imports* the GPL PlantUML-TS library becomes a derivative subject
  to GPL is the crux. Linking a GPL library generally triggers GPL on the
  consumer. So the "separate product consumes the public library" separation that
  works cleanly for EPL graphviz **may not hold** for GPL PlantUML.

**Paths to a clean commercial Jira plugin (pick after verifying):**
1. **Arm's-length architecture** — run the GPL PlantUML-TS as a *separate
   process/service* the plugin talks to over IPC/HTTP, an arrangement sometimes
   argued to avoid derivative-work status. Legally contested and fact-specific.
2. **PlantUML commercial license** — exists precisely so people can build closed
   commercial products without GPL obligations. This is how most commercial
   PlantUML products are legal. A real cost line — verify availability and price,
   because it may exceed early revenue and is therefore decision-relevant to the
   unit economics.

**Also verify:** **Atlassian Marketplace terms** for paid plugins bundling
copyleft (GPL) components — must satisfy both GPL *and* Atlassian's vendor
agreement, and they interact. Check before building, not at submission.

**Moat reality check:** at ~$100/year for a simple config, the moat is
**convenience, not closed code**. Even if the plugin must be GPL (freely
redistributable), the buyers are paying for not-having-to-configure-and-maintain
it — a Red Hat-style convenience/support moat that survives copyleft. Don't
over-engineer legal architecture for a modest side-business before demand is
proven; do the cheap afternoon of license-reading up front, then build the
simplest thing, then invest in clean architecture *if* it gets traction.

### ACTION ITEM before building Jira surface
Read PlantUML's exact current license + whether they offer commercial terms and
at what price. That single fact determines whether the plan is "just build it" or
"build it + buy a commercial license," which changes the unit economics.

---

## Editing & live preview (component breakdown — read carefully)

Two DIFFERENT capabilities, often conflated. Decompose them:

- **Live preview = build it for EVERY surface (yours, universal).** "Re-render
  the diagram as the source changes, debounced, injected into the preview pane."
  The host does NOT give you this for free — for a `plantuml` block, YOU supply
  the rendered content, and whether it updates live-as-you-type is your
  implementation. Build the render-on-change core ONCE; wire it into each
  surface's preview mechanism (VS Code webview, Obsidian preview, JetBrains JCEF,
  Confluence macro editor, standalone playground). Same core everywhere; only the
  preview-pane host differs. Users expect this (Mermaid-in-VS-Code updates live);
  without it the experience feels worse than incumbents. Lives in the
  live-webview family.
- **Text editor = host-supplied in dev surfaces; self-built ONLY in Confluence.**
  - **Dev surfaces (VS Code, Obsidian, JetBrains):** the host IS the code editor.
    You do NOT build editing here — you build live preview only.
  - **Confluence/Jira:** WYSIWYG, no ambient code editor, so YOU supply the full
    editing experience: a code editor (Monaco/CodeMirror) + **PlantUML syntax
    highlighting** (needs a PlantUML grammar) + **error surfacing** (inline
    where/why, needs good parser errors) + **autocomplete** + **template library**
    + sizing/pan/zoom + macro-lifecycle plumbing. This is the Confluence-specific
    build.

**"Trivial" is a trap.** A textarea + debounced preview pane IS trivial — but that
is NOT what the competitors ship or what buyers evaluate on. Every Atlassian
competitor leads with the editor (split-screen, 11–25 templates, syntax
highlighting). Budget for the REAL editor (grammar, errors, autocomplete,
templates), not the textarea skeleton. The skeleton is trivial; the competitive
editor is modest-but-real.

**Why the editor is a COMMERCIAL-surface need specifically:** in dev surfaces the
host supplies editing, so you skip it. Only Confluence lacks a host editor, so
the editor investment concentrates exactly where the revenue is — you build ONE
editor, for the one surface that lacks a host editor, which happens to be the
paid one. Clean alignment.

**Reuse leverage:** a good PlantUML editor *component* (CodeMirror/Monaco +
grammar + errors + live preview) is reusable beyond Confluence:
- A **standalone web playground** ("paste PlantUML, see it render instantly, no
  install") — excellent adoption/marketing/credibility tool, supports the
  goodwill/personal-brand story, and is a great thing to point Gergely / Chris &
  Don / HN at. Pure-TS means it runs fully client-side, no backend.
- Optionally enriches dev-surface previews if desired.

**Sequencing:** the full editor is a **Surface-4 (Confluence) component**, gated
on the licensing verification. Live preview, by contrast, ships with the
dev-surface adapters from the start. Do NOT build the full editor early — it
serves the revenue surface, which is last and conditional. (The standalone
playground is the one early exception worth considering, purely as a
marketing/adoption asset once the engine is public.)

---

## Pricing & competitive landscape (Atlassian commercial surface)

### Market read (from Atlassian Marketplace, captured during planning)

- **Fragmented, thin field; nobody dominates.** Example: "PlantUML Studio for
  Confluence" (paid, commercial) had **3 installs** — a polished paid app with
  near-zero traction. The field is scattered thin apps, none locking up the
  market.
- **Competitors compete on EDITOR/UX, not the engine.** Their listings lead with
  split-screen editors, 11–25 templates, live preview. None leads with rendering
  fidelity or a no-server/no-dependency story. **The engine is the axis nobody is
  competing on** — and it's your strength.
- **The market validates paid.** "PlantUML Diagrams for Confluence" (Stratus)
  *started free and converted to paid*; it's sold through enterprise resellers
  (e.g. Insight carries it as a SKU with explicit user tiers like 1400-user
  licenses). Real companies buy this at scale through procurement.
- **Data-residency is the live battleground — and you win it outright on Cloud.**
  Competitors tap-dance: Stratus's Cloud version transmits markup "through secured
  servers without storage" to generate previews — i.e. **markup still leaves the
  instance**; only their on-premise version has zero outbound traffic. **Your
  pure-TS engine renders entirely in-instance with ZERO outbound traffic even on
  Cloud** — uniquely, because everyone else relies on a Java/graphviz server
  somewhere. This is procurement-unblocking (passes security review where
  phone-home apps fail). LEAD WITH THIS.

### Pricing model & anchors

- **Model: per-user, annual, tiered by instance size** (Atlassian Marketplace
  standard). NOT flat-per-year. The "$100/yr vs $500/yr" framing was the wrong
  *shape* — price is a per-user curve, small instances → enterprise instances.
- **Low anchor was way too low.** The $100/year instinct is ~1–2 orders of
  magnitude under enterprise reality.
- **Direct-category anchor:** the per-user PlantUML apps sold through resellers at
  1000+-user tiers — real per-user enterprise pricing. **Get exact numbers by
  opening the competitors' Marketplace pricing tabs in a logged-in browser**
  (they render client-side; quick to read directly). This is the precise
  competitor rate to price against.
- **High anchor / ceiling:** PowerBI-in-Confluence integration ≈ **$10K/year**
  (real datapoint: enterprise Confluence buyer). A diagram renderer sits *below*
  a full BI embed but in the same "thousands, not hundreds" universe for
  enterprise tiers.

### Pricing recommendation

- **Adopt per-user tiered pricing** (match the channel).
- **Price competitively against the direct PlantUML competitors' per-user rates**
  (get exact numbers from their pricing tabs), positioned **slightly above** the
  thin commodity apps (engine + zero-outbound-traffic justify a premium) and
  **below** the PowerBI ceiling.
- **But: price is NOT the main lever — differentiation is.** Paid competitors
  aren't winning at *any* price (3 installs). The market is unwon and fragmented.
  Don't "undercut PlantUML Studio" — be the one that's actually faithful, renders
  with zero outbound traffic on Cloud, needs no server, and price to enterprise
  value via per-user tiers. Competitive pricing is table stakes; the engine +
  data-residency differentiation is the win.

### Pricing/competitive action items
- [ ] Open competitor Marketplace pricing tabs in a logged-in browser; record
      exact per-user tier rates (PlantUML Studio, "Diagrams & Charts," Stratus's
      "Diagrams for Confluence").
- [ ] Confirm the zero-outbound-traffic claim holds for the pure-TS engine on
      Confluence **Cloud** specifically (the differentiator's foundation).

---

## Cross-cutting: the "pre-render to SVG" path is its own product

Independent of any IDE plugin, a **CLI / CI tool** that turns `.puml` files (or
fenced blocks) into committed SVGs renders "on GitHub" by just being images,
works in *any* image-displaying markdown surface, and sidesteps every plugin API.
The GitHub Action (Surface 1) is one packaging of this; a standalone CLI is
another. Possibly the widest-reach, lowest-friction distribution of all, and it
reuses the exact same engine.

---

## Recommended build sequence

Ordered by effort-to-reach ratio. The two adapter *families* mean several of
these share a core — build the core once per family, then thin per-target wrappers.

1. **GitHub Action** (pre-render family) — thinnest adapter, widest reach,
   answers the GitHub goal, fastest path to real-world usage + bug reports.
   Ship first. Establishes the pre-render core.
2. **remark/rehype plugin** (pre-render family) — HIGHEST ecosystem leverage:
   one plugin serves Docusaurus/VitePress/Astro/MDX/etc. Reuses the pre-render
   core from #1. Strongly consider second (or even co-first) on leverage grounds.
3. **VS Code plugin** (live-webview family) — clean plugin API, engine is the
   right shape, beats incumbents on no-dependencies. Establishes the
   live-webview core. The live-authoring win.
4. **Obsidian plugin** (live-webview family) — high fit, dependency-averse
   local-first audience that the no-Java/no-server property directly serves.
   Reuses the live-webview core from #3.
5. **Browser extension** (own shape) — reaches github.com/gitlab.com
   client-side; cleaner than the WASM/TeaVM incumbent (no CSP relaxation).
   Live render on surfaces you can't plug into.
6. **JetBrains plugin** (live-webview family) — same use case as VS Code/Obsidian,
   heavier (JVM-wraps-TS). Do if demand appears.
7. **Jira plugin** (commercial) — **gate on the PlantUML licensing verification**
   before building.

Underneath all of it: one engine, two adapter families (+ the extension shape).
Each family core is built once; each target is a thin wrapper on its family core.

### Surfaces covered incidentally / folded elsewhere
- **GitLab.com**: same server-rendered constraint as GitHub → covered by the
  browser extension (live) or pre-render/committed-SVG (Action). No separate work.
- **Self-hosted GitLab**: audience = teams who don't want to run a PlantUML
  server → served by the pre-render path. Conditional, low priority.
- **MkDocs / other build tools**: pre-render family; covered if the pre-render
  core is kept general.
- **Confluence**: fold into the Atlassian/Jira thread, not a separate effort.
- **Notion**: closed, no rendering plugin API → not reachable. Skip.
- **Markdown-editor long tail** (Typora, Mark Text, etc.): small audiences, not
  worth individual adapters.

---

## Open verification items (do before relying on each)

- [ ] VS Code `markdown.markdownItPlugins` contribution-point API + how existing
      Mermaid extensions wire in (template for Surface 2).
- [ ] JetBrains markdown-preview extension surface + JCEF bridge approach
      (Surface 3).
- [ ] **PlantUML exact license + commercial-license availability/price**
      (gates Surface 4; highest priority).
- [ ] Atlassian Marketplace vendor terms re: bundling GPL components (Surface 4).
- [ ] GitHub Action commit-back loop-prevention pattern + permissions model
      (Surface 1 implementation detail).
- [ ] remark/rehype plugin API + mdast/hast node handling; confirm it works in
      serverless build envs (Vercel/Netlify) with no native deps (Surface 5).
- [ ] Obsidian plugin API — code-block processor registration + preview
      injection (Surface 6).
- [ ] Browser-extension MV3 manifest with NO `wasm-unsafe-eval` needed (confirm
      the pure-TS engine truly needs no CSP relaxation); content-script scoping;
      Chrome Web Store + Firefox review requirements (Surface 7).

---

## Prior art / competitive landscape

### `plantuml/plantuml-for-github` (browser extension)

Repo: https://github.com/plantuml/plantuml-for-github (official-ish — under the
`plantuml` org itself, MIT, ~13 stars, v0.2.4 as of May 2026, small/early).

**What it is:** a Chrome/Firefox extension that renders `plantuml` code blocks
on GitHub pages **client-side**, by injecting a sandboxed iframe per block. The
iframe loads a **TeaVM-compiled** `plantuml.js` (the actual Java PlantUML
transpiled to JS) and renders to SVG. For graph-layout diagram types (class,
component, deployment, state, use-case, activity) it relies on an **embedded
Graphviz WebAssembly module** (`viz-global.js`). Sequence diagrams render
directly without graphviz.

**Stack = TeaVM-transpiled-Java PlantUML + graphviz-WASM** — i.e. exactly the
WASM/transpile-blob path our native-TS engine was built to replace.

### Why our path is genuinely cleaner (from their own README)

- **They must relax Manifest V3 CSP.** MV3's default `script-src 'self'` blocks
  WebAssembly, so they add `'wasm-unsafe-eval'` to instantiate the graphviz-WASM
  module. They have to document and defend this concession to extension-store
  reviewers. **Our pure-TS engine never instantiates WASM, so it needs no CSP
  relaxation** — a strictly cleaner, more-defensible security story on the exact
  axis they flag as their weakest.
- **TeaVM-transpiled Java + WASM carry the heavy per-call / cold-start profile.**
  Native TS sidesteps BOTH the graphviz-WASM module AND the TeaVM PlantUML
  runtime. We replace both heavy components with native TypeScript.

### Why this is validation, not competition

- **It proves the demand.** Their README: PlantUML-on-GitHub has been requested
  for **4+ years** (community discussion #10111, still open). The longstanding
  blocker was "performance and infrastructure cost." That's our entire thesis,
  documented by someone else. Track #10111:
  https://github.com/orgs/community/discussions/10111
- **It confirms the only solutions are heavy.** Every "PlantUML on GitHub" answer
  to date wraps a heavy engine (WASM and/or transpiled Java). Our native-TS
  engine is the better fill for the same documented demand.

### The cost asymmetry (names the "cheaper-path-heavier-result" tradeoff)

- **They took the cheap path to a heavier result:** glue two existing compiled
  artifacts (TeaVM PlantUML.js + viz-WASM), ~12 commits, working MVP, low cycles.
- **We took the expensive path to a lighter result:** a faithful native
  reimplementation (the months-long graphviz port) — but that cost is **mostly
  sunk now**. The remaining cycles to ship a GitHub surface are comparable to
  *their entire project* (the extension/glue layer), on top of an engine that's
  already built. So "cleaner but hella expensive" is precise: the expense is
  real and nearly paid; what's left is the thin adapter.

### Strategic implications

- **Strengthens the "contact PlantUML upstream" thread.** The PlantUML org is
  *already actively working the browser-rendering problem* — with the WASM/TeaVM
  approach because that's what they had. A pure-TS faithful engine is exactly
  what they'd want and don't have. They're not just the algorithm authors; they
  are working the same problem we solved more cleanly. Direct relevance to their
  roadmap, not just a downstream port.
- **Use it as the differentiator in positioning.** When describing the GitHub
  surface, cite the CSP/WASM concession as the thing we're cleaner than, and
  #10111 as the 4-year-old proof of demand.
- **Note the surface difference:** theirs is a *browser extension* (per-user
  install, client-side render). Ours can be a browser extension too, but the
  **GitHub Action / pre-render-to-SVG path is a different and broader surface** —
  no per-reader install required, works in any image-displaying context, not just
  for users who installed an extension. Consider both: extension for live
  client-side render (match their UX, cleaner stack), Action for
  install-free universal display.
