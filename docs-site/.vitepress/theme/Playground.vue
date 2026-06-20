<!-- SPDX-License-Identifier: EPL-2.0 -->
<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
// Aliased in .vitepress/config.ts to the real engine source (src/index.ts),
// so the playground always runs the library exactly as shipped.
import { renderSvg } from 'graphviz-ts';

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

onMounted(renderNow);
watch([source, engine], scheduleRender);
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
      <textarea
        v-model="source"
        class="gv-input"
        spellcheck="false"
        aria-label="DOT source"
      ></textarea>
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
.gv-input {
  border: none;
  border-right: 1px solid var(--vp-c-divider);
  padding: 0.75rem;
  font-family: var(--vp-font-family-mono);
  font-size: 0.85rem;
  resize: none;
  outline: none;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
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
