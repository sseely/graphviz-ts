// SPDX-License-Identifier: EPL-2.0
//
// Warm worker for the in-process perf bench (test/corpus/bench.mjs). Imports the
// SHIPPED bundle (dist/index.js) once, stays resident, and times one renderSvg
// call per request so the measured region excludes all process/module startup.
// The main thread drives one render at a time and enforces a wall-clock cap by
// terminating this worker if a synchronous render never returns (true hang).
//
// Node-only dev/test infra; run indirectly via bench.mjs.

import { parentPort, workerData } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';

const { renderSvg } = await import(workerData.bundleUrl);

// Signal the bundle is loaded and renderSvg is callable.
parentPort.postMessage({ ready: true });

parentPort.on('message', (msg) => {
  // Each message is one render request: { src }. Reply { ms, bytes } or { error }.
  try {
    const t = performance.now();
    const svg = renderSvg(msg.src, 'dot');
    const ms = performance.now() - t;
    parentPort.postMessage({ ms, bytes: svg.length });
  } catch (e) {
    parentPort.postMessage({ error: e instanceof Error ? e.message : String(e) });
  }
});
