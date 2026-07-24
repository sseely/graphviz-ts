<!-- SPDX-License-Identifier: EPL-2.0 -->
<script setup lang="ts">
// Renders a set of golden graphs CLIENT-SIDE via the library. The sources come
// from copy-goldens.mjs (goldens.json); each card renders lazily (on scroll into
// view) so the 160-entry `dot` page stays snappy. `@knowvah/dot-engine` is
// aliased to src/index.ts in config.ts, so this runs the library as it ships.
// Clicking a rendered diagram opens an enlarged lightbox view.
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { tryRenderSvg } from '@knowvah/dot-engine';
import goldensJson from '../goldens.json';

interface Golden {
  id: string;
  description: string;
  toleranceClass: string;
  dot: string;
}
const goldens = goldensJson as unknown as {
  byEngine: Record<string, Golden[]>;
};

const props = defineProps<{ engine: string }>();
const items = computed<Golden[]>(() => goldens.byEngine[props.engine] ?? []);

const rendered = ref<Record<string, { svg?: string; error?: string }>>({});
const cards = new Map<string, HTMLElement>();
let observer: IntersectionObserver | undefined;

// Map graphviz's default black stroke/text to `currentColor` so diagrams follow
// the page's light/dark theme; explicit colors in the graph are preserved.
function themeAware(svg: string): string {
  const i = svg.indexOf('<svg');
  return (i > 0 ? svg.slice(i) : svg)
    .replace(/(stroke|fill)="black"/g, '$1="currentColor"')
    .replace(/(stroke|fill)="#000000"/g, '$1="currentColor"')
    .replace(/(stroke|fill)="#000"/g, '$1="currentColor"');
}

function renderOne(id: string): void {
  if (rendered.value[id]) return;
  const g = items.value.find((x) => x.id === id);
  if (!g) return;
  try {
    const r = tryRenderSvg(g.dot, props.engine);
    rendered.value = {
      ...rendered.value,
      [id]: r.svg
        ? { svg: themeAware(r.svg) }
        : { error: r.errors?.[0]?.friendlyMessage ?? 'Render failed' },
    };
  } catch (e) {
    rendered.value = {
      ...rendered.value,
      [id]: { error: e instanceof Error ? e.message : String(e) },
    };
  }
}

function setCard(id: string, el: unknown): void {
  if (el instanceof HTMLElement) {
    cards.set(id, el);
    observer?.observe(el);
  }
}

// --- lightbox (click a rendered diagram to enlarge) ---
const active = ref<Golden | null>(null);

function open(g: Golden): void {
  if (!rendered.value[g.id]?.svg) return; // only enlarge rendered diagrams
  active.value = g;
  if (typeof document !== 'undefined') document.body.style.overflow = 'hidden';
}
function close(): void {
  active.value = null;
  if (typeof document !== 'undefined') document.body.style.overflow = '';
}
function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') close();
}

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const id = (entry.target as HTMLElement).dataset.id;
        if (id) renderOne(id);
        observer!.unobserve(entry.target);
      }
    },
    { rootMargin: '300px' },
  );
  for (const el of cards.values()) observer.observe(el);
  window.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  window.removeEventListener('keydown', onKey);
  if (typeof document !== 'undefined') document.body.style.overflow = '';
});
</script>

<template>
  <div class="golden-grid">
    <figure
      v-for="g in items"
      :key="g.id"
      class="golden-card"
      :data-id="g.id"
      :ref="(el) => setCard(g.id, el)"
    >
      <div
        class="golden-frame"
        :class="{ clickable: rendered[g.id]?.svg }"
        :title="rendered[g.id]?.svg ? 'Click to enlarge' : undefined"
        role="button"
        tabindex="0"
        @click="open(g)"
        @keydown.enter="open(g)"
      >
        <div
          v-if="rendered[g.id]?.svg"
          class="golden-svg"
          v-html="rendered[g.id]!.svg"
        ></div>
        <div v-else-if="rendered[g.id]?.error" class="golden-err" role="alert">
          {{ rendered[g.id]!.error }}
        </div>
        <div v-else class="golden-wait">rendering…</div>
        <span v-if="rendered[g.id]?.svg" class="golden-zoom" aria-hidden="true">⤢</span>
      </div>
      <figcaption>
        <code class="golden-id">{{ g.id }}</code>
        <span class="golden-tol" :data-tol="g.toleranceClass">{{ g.toleranceClass }}</span>
        <span class="golden-desc">{{ g.description }}</span>
      </figcaption>
      <details class="golden-src">
        <summary>DOT source</summary>
        <pre><code>{{ g.dot }}</code></pre>
      </details>
    </figure>
  </div>

  <Teleport to="body">
    <div
      v-if="active"
      class="golden-modal"
      role="dialog"
      aria-modal="true"
      :aria-label="`${active.id}: ${active.description}`"
      @click="close"
    >
      <div class="golden-modal-card" @click.stop>
        <header class="golden-modal-head">
          <code class="golden-id">{{ active.id }}</code>
          <span class="golden-desc">{{ active.description }}</span>
          <button class="golden-modal-x" aria-label="Close" @click="close">✕</button>
        </header>
        <div class="golden-modal-body" v-html="rendered[active.id]?.svg"></div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.golden-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  margin: 20px 0;
}
.golden-card {
  margin: 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  overflow: hidden;
  background: var(--vp-c-bg-soft);
}
.golden-frame {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 180px;
  padding: 14px;
  background: var(--vp-c-bg);
  overflow: auto;
}
.golden-frame.clickable {
  cursor: zoom-in;
}
.golden-frame.clickable:hover {
  background: var(--vp-c-bg-alt);
}
.golden-svg :deep(svg) {
  max-width: 100%;
  height: auto;
}
.golden-zoom {
  position: absolute;
  top: 6px;
  right: 8px;
  font-size: 13px;
  line-height: 1;
  padding: 3px 5px;
  border-radius: 6px;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg-soft);
  opacity: 0;
  transition: opacity 0.15s;
}
.golden-frame.clickable:hover .golden-zoom {
  opacity: 0.9;
}
.golden-wait,
.golden-err {
  font-size: 13px;
  color: var(--vp-c-text-3);
}
.golden-err {
  color: var(--vp-c-danger-1);
  text-align: left;
  white-space: pre-wrap;
}
figcaption {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
  align-items: baseline;
  padding: 10px 12px;
  font-size: 13px;
}
.golden-id {
  font-weight: 600;
}
.golden-tol {
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-2);
}
.golden-tol[data-tol='deterministic'] {
  background: var(--vp-c-tip-soft);
  color: var(--vp-c-tip-1);
}
.golden-tol[data-tol='iterative'] {
  background: var(--vp-c-warning-soft);
  color: var(--vp-c-warning-1);
}
.golden-desc {
  flex: 1 1 100%;
  color: var(--vp-c-text-2);
}
.golden-src {
  border-top: 1px solid var(--vp-c-divider);
}
.golden-src summary {
  padding: 8px 12px;
  font-size: 12px;
  color: var(--vp-c-text-3);
  cursor: pointer;
}
.golden-src pre {
  margin: 0;
  padding: 0 12px 12px;
  overflow: auto;
  font-size: 12px;
}

/* --- lightbox --- */
.golden-modal {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.66);
  backdrop-filter: blur(2px);
}
.golden-modal-card {
  display: flex;
  flex-direction: column;
  max-width: 94vw;
  max-height: 92vh;
  border-radius: 12px;
  overflow: hidden;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
}
.golden-modal-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--vp-c-divider);
  font-size: 14px;
}
.golden-modal-head .golden-desc {
  flex: 1;
  color: var(--vp-c-text-2);
}
.golden-modal-x {
  flex: none;
  border: none;
  background: transparent;
  color: var(--vp-c-text-2);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 6px;
}
.golden-modal-x:hover {
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-1);
}
.golden-modal-body {
  display: flex;
  align-items: center;
  justify-content: center;
  width: min(90vw, 1400px);
  height: 84vh;
  padding: 20px;
  overflow: auto;
  background: var(--vp-c-bg);
}
.golden-modal-body :deep(svg) {
  width: 100%;
  height: 100%;
}
</style>
