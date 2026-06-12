# Architecture Decision Records

Append-only log. Every agent decision that deviates from or refines ARCHITECTURE.md v2.0 gets an entry.

---

## ADR-001 — Plan acknowledged, execution kickoff
**Date:** 2026-06-11 · **Author:** Orchestrator (Claude Code)

ARCHITECTURE.md v2.0 read in full. Stack confirmed: TypeScript strict + Phaser 3.90.0 + Vite 8 + Vitest 4 + Playwright, Capacitor deferred to Phase 4. Phase 1 begins now; phase gates will be recorded here with evidence.

## ADR-002 — Execution-environment adaptations
**Date:** 2026-06-11 · **Author:** Orchestrator

Deviations from the doc, forced by the execution environment (Windows 11 workstation, no cloud creds, no test devices attached):

1. **Roles executed inline by one orchestrating session** rather than long-lived parallel subagent sessions. The §5 contracts are preserved (QA acceptance tests written against phase-gate criteria before features are merged; gates recorded here with evidence) — only the process topology changes. Rationale: a single session keeps `core/` interfaces coherent and avoids merge-conflict churn on a greenfield repo.
2. **Placeholder art is procedural** (Phaser Graphics → generateTexture at boot) instead of Kenney.nl downloads. Zero licensing risk, zero network dependency, swappable later exactly like any sprite sheet. Player creature: a seal.
3. **Preview URL = local `vite preview`** until a git remote + Pages/Netlify account is connected. CI workflow (`.github/workflows/ci.yml`) includes a Pages deploy job that activates when the repo is pushed to GitHub.
4. **npm initially resolved `phaser@4.1.0`;** pinned back to `phaser@^3.90.0` per the stack table ("latest 3.x").
5. **Mid-range-device 60fps checks (G1/G3) deferred** to when hardware is available; desktop Chrome perf is the local proxy and is recorded as such, not as gate satisfaction.

## ADR-003 — Buoyancy delivered via FluidField, gravity/drag/swim in FluidBody
**Date:** 2026-06-11 · **Author:** Physics

Per §4.3 the Classic `FluidField.sampleForce(x,y,t)` returns the constant net buoyancy vector `(0, -buoyancyAccel)`. `FluidBody` owns gravity, quadratic drag, swim-impulse blending, and velocity clamps. All forces are expressed as accelerations (mass normalized to 1) — masses never appear in tuning, which keeps physics.json human-tunable. Future current/vortex modes only swap the field implementation.

## ADR-004 — Physics tuning v2: smaller chainable tap, faster sink, conservative descent clamps
**Date:** 2026-06-11 · **Author:** Physics + QA

Initial tuning (impulse 420/buoyancy 430 → ~95 px tap arc) failed the fairness sim: the arc height nearly equaled the gap half-height (105 px), so every in-gap brake-tap injected ~1 gap-height of altitude, and quadratic drag makes descents slow — the reference bot clipped top lips on descending transitions in >99% of seeds. Fix: swimImpulse 420→330 (arc ≈ 50 px — finer control quantum), buoyancyAccel 430→400 (terminal sink ≈ 119.5 px/s, top of the §4.2 range), and difficulty clamps maxRisePerSecond 170→100 / maxSinkPerSecond 100→45. Result: 0 failures in 10,000 seeded runs at 15 gates each. Feel-spec arc range adjusted 60–140 → 40–120 px (doc §4.2 gives no numeric arc bound; "gentle/swimmy" is preserved — tap still blends over 3 frames against drag). Lesson recorded in PHYSICS_SPEC.md: descents, not climbs, are the binding fairness constraint underwater.
