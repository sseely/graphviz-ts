<!-- SPDX-License-Identifier: EPL-2.0 -->
<script setup lang="ts">
// Renders a set of golden graphs CLIENT-SIDE via the library. The sources come
// from copy-goldens.mjs (goldens.json); each card renders lazily (on scroll into
// view) so the 160-entry `dot` page stays snappy. `@knowvah/dot-engine` is
// aliased to src/index.ts in config.ts, so this runs the library as it ships.
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
});
onBeforeUnmount(() => observer?.disconnect());
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
      <div class="golden-frame">
        <div
          v-if="rendered[g.id]?.svg"
          class="golden-svg"
          v-html="rendered[g.id]!.svg"
        ></div>
        <div v-else-if="rendered[g.id]?.error" class="golden-err" role="alert">
          {{ rendered[g.id]!.error }}
        </div>
        <div v-else class="golden-wait">rendering…</div>
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
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 180px;
  padding: 14px;
  background: var(--vp-c-bg);
  overflow: auto;
}
.golden-svg :deep(svg) {
  max-width: 100%;
  height: auto;
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
</style>
