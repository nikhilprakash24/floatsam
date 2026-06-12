# Test Plan

Coverage floor: 80% on `src/core/`. Scenes/UI are covered by e2e, not unit tests.

| Layer | Tool | Files | What |
|---|---|---|---|
| Unit | Vitest | tests/unit/*.test.ts | Fluid math (drag, buoyancy, clamps, swim blending), RNG determinism, FSM transitions, spawner geometry, scoring |
| Simulation | Vitest | tests/sim/*.test.ts | Feel targets §4.2 (terminal velocity, tap arc height/duration), determinism (same seed ⇒ identical run), fairness (10,000 seeded runs — every gap passable by reference bot from worst-case entry), difficulty curve sanity |
| E2E | Playwright | tests/e2e/*.spec.ts | Boot → menu → play → die → game over → restart; best-score persistence across reload; mute persistence; pause on visibility change |
| Performance | Playwright/manual | — | Bundle budget < 3 MB initial load (asserted in e2e via resource sizes); FPS counter sanity; 10-min heap soak (manual until CI hardware) |

## Phase gate checklists
- **G1:** sandbox playable; sim feel tests green; CI green. Evidence → DECISIONS.md.
- **G2:** full loop playable; fairness suite green; restart < 1 s; best score survives reload.
- **G3:** Lighthouse ≥ 90 (manual until CI); cross-browser matrix; bundle budget; PWA installable.
- **G4:** device benchmarks (deferred — see ADR-002).
