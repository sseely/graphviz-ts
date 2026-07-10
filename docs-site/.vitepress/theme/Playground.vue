<!-- SPDX-License-Identifier: EPL-2.0 -->
<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
// Aliased in .vitepress/config.ts to the real engine source (src/index.ts),
// so the playground always runs the library exactly as shipped.
import { renderSvg } from 'graphviz-ts';
// Client-side DOT syntax highlighting, reusing the SAME grammar the docs code
// blocks use (single source of truth). Shiki runs in the browser here over a
// transparent-textarea overlay; the plain textarea still works if it fails to
// load (progressive enhancement).
import { createHighlighterCore, type HighlighterCore } from 'shiki/core';
import { createOnigurumaEngine } from 'shiki/engine/oniguruma';
import githubLight from '@shikijs/themes/github-light';
import githubDark from '@shikijs/themes/github-dark';
import { dotLang } from '../dot.tmLanguage';

const ENGINES = [
  'dot', 'neato', 'fdp', 'sfdp', 'circo', 'twopi', 'osage', 'patchwork',
];

const DEFAULT_DOT = `digraph G {
  rankdir=LR;
  a -> b -> c;
  a -> c;
}`;

const props = defineProps<{
  initial?: string;
  engine?: string;
  height?: string;
}>();

const source = ref(props.initial ?? DEFAULT_DOT);
const engine = ref(props.engine ?? 'dot');
const svg = ref('');
const error = ref('');

// --- syntax-highlight overlay ---
const highlighted = ref('');
const overlaid = ref(false); // true once the highlighter has painted a layer
const highlightEl = ref<HTMLElement | null>(null);
let highlighter: HighlighterCore | undefined;

function paintHighlight(): void {
  if (!highlighter) return;
  // Trailing newline keeps the highlight layer's height in step with the
  // textarea while the last line is being typed.
  highlighted.value = highlighter.codeToHtml(`${source.value}\n`, {
    lang: 'dot',
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false,
  });
  overlaid.value = true;
}

function syncScroll(e: Event): void {
  const ta = e.target as HTMLTextAreaElement;
  if (highlightEl.value) {
    highlightEl.value.scrollTop = ta.scrollTop;
    highlightEl.value.scrollLeft = ta.scrollLeft;
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;

function renderNow(): void {
  // Render is client-only; layout uses the browser's native canvas measurer.
  if (typeof window === 'undefined') return;
  try {
    svg.value = renderSvg(source.value, engine.value);
    error.value = '';
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}

function scheduleRender(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(renderNow, 250);
}

onMounted(async () => {
  renderNow();
  try {
    highlighter = await createHighlighterCore({
      themes: [githubLight, githubDark],
      langs: [dotLang],
      engine: createOnigurumaEngine(import('shiki/wasm')),
    });
    paintHighlight();
  } catch {
    // Highlighter unavailable — the plain (visible) textarea keeps working.
  }
});

watch(source, () => { paintHighlight(); scheduleRender(); });
watch(engine, scheduleRender);
</script>

<template>
  <div class="gv-playground">
    <div class="gv-toolbar">
      <label>
        Engine:
        <select v-model="engine">
          <option v-for="e in ENGINES" :key="e" :value="e">{{ e }}</option>
        </select>
      </label>
    </div>
    <div class="gv-panes" :style="{ height: props.height ?? '420px' }">
      <div class="gv-editor">
        <div
          ref="highlightEl"
          class="gv-highlight"
          aria-hidden="true"
          v-html="highlighted"
        ></div>
        <textarea
          v-model="source"
          class="gv-input"
          :class="{ overlaid }"
          spellcheck="false"
          autocapitalize="off"
          autocomplete="off"
          aria-label="DOT source"
          @scroll="syncScroll"
        ></textarea>
      </div>
      <div class="gv-output" aria-label="Rendered SVG">
        <pre v-if="error" class="gv-error">{{ error }}</pre>
        <div v-else class="gv-svg" v-html="svg"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gv-playground {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
  margin: 1rem 0;
}
.gv-toolbar {
  display: flex;
  gap: 1rem;
  align-items: center;
  padding: 0.5rem 0.75rem;
  background: var(--vp-c-bg-soft);
  border-bottom: 1px solid var(--vp-c-divider);
  font-size: 0.85rem;
}
.gv-toolbar select {
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  padding: 0.15rem 0.4rem;
  background: var(--vp-c-bg);
}
.gv-panes {
  display: grid;
  grid-template-columns: 1fr 1fr;
}

/* Editor: a highlighted layer behind a transparent textarea. Both must share
   identical text metrics so the caret lines up with the painted glyphs. */
.gv-editor {
  position: relative;
  border-right: 1px solid var(--vp-c-divider);
  overflow: hidden;
  background: var(--vp-c-bg);
}
.gv-highlight,
.gv-input {
  margin: 0;
  padding: 0.75rem;
  font-family: var(--vp-font-family-mono);
  font-size: 0.85rem;
  line-height: 1.5;
  tab-size: 4;
  white-space: pre;
  word-wrap: normal;
  overflow-wrap: normal;
  border: none;
}
.gv-highlight {
  position: absolute;
  inset: 0;
  overflow: auto;
  pointer-events: none;
}
.gv-highlight :deep(pre.shiki) {
  margin: 0;
  padding: 0;
  background: transparent !important;
  font: inherit;
}
.gv-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  resize: none;
  outline: none;
  background: transparent;
  color: var(--vp-c-text-1); /* visible until the highlight layer paints */
  caret-color: var(--vp-c-text-1);
  overflow: auto;
}
.gv-input.overlaid {
  color: transparent; /* text is shown by the layer behind; keep the caret */
}
.gv-output {
  overflow: auto;
  padding: 0.75rem;
  background: #fff;
}
.gv-svg :deep(svg) {
  max-width: 100%;
  height: auto;
}
.gv-error {
  color: var(--vp-c-danger-1);
  white-space: pre-wrap;
  font-size: 0.8rem;
  margin: 0;
}
@media (max-width: 640px) {
  .gv-panes {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr 1fr;
    height: auto !important;
  }
}
</style>

<style>
/* UNSCOPED on purpose. defaultColor:false emits token colors as
   --shiki-light/--shiki-dark CSS variables, not a `color`; these rules map
   them to the live color, switching on VitePress's html.dark. They cannot
   live in the scoped block: Vue does not support :global() as an ancestor
   combinator, so a scoped `html.dark …` rule never matches and dark mode
   would paint the light palette onto the dark background. */
.gv-playground .gv-highlight .shiki,
.gv-playground .gv-highlight .shiki span {
  color: var(--shiki-light);
}
html.dark .gv-playground .gv-highlight .shiki,
html.dark .gv-playground .gv-highlight .shiki span {
  color: var(--shiki-dark);
}
</style>
