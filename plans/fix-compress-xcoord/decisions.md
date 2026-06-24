# Decisions & evidence — fix-compress-xcoord

## D1. Root cause is compress x-coordinate, NOT spline routing (2026-06-24)
Three hypotheses were tested and the first two rejected by oracle instrumentation:
- ❌ Spline router over-segments (`routeRegularEdgeFaithful` / `Proutespline`).
- ❌ Missing opposing-edge port offset on the base spline.
- ✅ Broad `ratio=compress` x-coordinate divergence.

Decisive probe: instrumented C `beginpath` (lib/common/splines.c:392) for
`Target->TThread` →
`tail_port.p=[0.00,0.00] coord=[675.0,450.0] start=[675.0,450.0]`.
`tail_port.p` is zero — no port offset. The +8 vs the TS port (667) is the **node
coordinate** `ND_coord(Target).x`, i.e. the x-NS result differs.

## D2. Evidence — node-x compare (the diff that pinned it)
TS (compress cherry-picked) vs native, both via `GVBINDIR=/tmp/gvplugins` oracle:
**53/76 nodes off in X only (all `dy=0`), dx −5..+1pt.** Sample: MC68Frame −5,
SparcFrame −5, VaxFrame −4, ~20 nodes −3 (incl. TThread −3), several −2/−1, a
handful +1. Reuse this script (run from repo root with both SVGs rendered):

```js
const fs=require("fs");
function coords(f){const s=fs.readFileSync(f,"utf8");const m={};
  const re=/<title>([^<]+)<\/title>\s*<ellipse[^>]*cx="(-?[\d.]+)"[^>]*cy="(-?[\d.]+)"/g;let x;
  while((x=re.exec(s))) if(!x[1].includes("&")) m[x[1]]={x:+x[2],y:+x[3]};
  return m;}
const a=coords("/tmp/nan-ts.svg"), b=coords("/tmp/nan-c.svg");
let d=[];
for(const k in b){ if(!a[k])continue; const dx=+(a[k].x-b[k].x).toFixed(2), dy=+(a[k].y-b[k].y).toFixed(2);
  if(Math.abs(dx)>0.5||Math.abs(dy)>0.5) d.push([k,dx,dy]); }
console.log("nodes:",Object.keys(b).length,"off:",d.length);
d.sort((p,q)=>Math.abs(q[1])-Math.abs(p[1])); for(const x of d) console.log(x[0].padEnd(16),"dx="+x[1],"dy="+x[2]);
```

## D3. Symptom math (why the spline over-segments)
TThread −3pt × 0.2429 (corridor-entry fraction (449−432)/(449−379)) = 0.73pt.
That flips the tail→head straight line at the tail-box bottom (y=432) from
C's 626.2 vs wall 626 (**inside 0.2px**) to TS's 617.45 vs wall 618
(**outside 0.55px**) → `shortestPath` bends at the box corner → extra bezier
(7 pts vs 4). Confirms: fix node-x, spline self-resolves. Do not touch the router.

## D4. compressGraph is faithful — look downstream
`src/layout/dot/position-cluster.ts:265 compressGraph` matches
`position.c:501 compress_graph` line-for-line. Divergence is in `containNodes`
margins/window, the `size` value (compress+landscape flip), or the x-NS solve
under the width-constraint aux edge. Related known window bugs to check first:
memory `contain-nodes-vstart-window` (raw `rk.v[0]` vs `rankGet(vStart)`),
`hang-2475-2-xcoord-ns` (keepout read raw rk.v[0]).

## D5. Compress lands with this fix
`ratio=compress` activation = `feature/ratio-compress` @ 6ef3eeb, unmerged by
prior decision (held for this fix). This mission cherry-picks it as the Batch-1
foundation; compress + the x-coord fix merge together.

## Open question for T2
Is the dx non-uniformity (−5..+1, not a flat shift) driven by (a) a wrong total
width target `x` (would shift more uniformly), or (b) per-rank containNodes
margins / LR-constraint interaction (redistributes non-uniformly)? The spread
favors (b) — verify before fixing.
