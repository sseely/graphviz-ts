# Architecture Decisions — dot-edge-multi

## AD-1: Port the C functions; do not characterize first

**Context:** A "trace which path each case takes" task was proposed.
**Decision:** Skip it. Port `make_flat_labeled_edge` and the `make_regular_edge`
multi-edge / label-vnode logic faithfully from the C; the port captures the
hard-won nuances a characterization pass would gloss over.
**Consequences:** Tasks map 1:1 to C functions. The executor reads the C as the
spec, not a summary.

## AD-2: Extend the hybrid — new cases use the faithful pipeline only

**Context:** Plain edges use a simplified fitter byte-exact to the 115 goldens;
side-port/flat/steering edges use the faithful `routeSplines` pipeline (the
project's standing AD2/AD3 hybrid).
**Decision:** Route the NEW cases (multi-edge cnt>1, opposing pairs, labeled
parallels, flat-labeled) through the faithful pipeline. Plain single edges keep
the simplified fitter untouched.
**Consequences:** The 115 goldens stay byte-identical (none uses these cases) —
this is a hard gate. Do not replace the working plain-edge router.

## AD-3: Parity bar = dot-oracle pins at tol 0.5, verified vs built dot

**Context:** New geometry needs regression protection.
**Decision:** Pin each new case as a dot-oracle test (assert vs the built dot's
values, tol 0.5 deterministic), in the existing `*-oracle.test.ts` style.
**Consequences:** Tests encode dot parity, not graphviz-ts self-output. A value
that can't reach tol 0.5 is not silently pinned — see AD-4.

## AD-4: Un-reachable parity is quarantined with a comparison page

**Context:** Some sub-case may not reach tol 0.5 within the mission.
**Decision:** Quarantine it: pin graphviz-ts's actual output, write a
`comparisons/<case>.html` page (dot vs ts SVG side-by-side + measured delta +
root-cause), and reference it in the journal. A batch with any quarantined case
is not complete until its page exists.
**Consequences:** No silent divergence. Mirrors the steering-port mission.

## AD-5: Fence — G2 and G3 are out of scope

**Context:** The corpus also found G2 (multiple compass ports off one node) and
G3 (nested clusters, a layout gap).
**Decision:** Out of scope. G2 is dot-splines port residue; G3 is a separate
cluster-layout mission.
**Consequences:** If a task's fix would require touching multi-port or nested-
cluster code, stop and log — do not expand scope.
