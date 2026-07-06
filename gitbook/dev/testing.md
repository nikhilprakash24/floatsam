# Running & testing

## Commands

```bash
npm run dev          # Vite dev server, http://localhost:5173, HMR
npm run build        # typecheck + production bundle → dist/
npm test             # 94 unit + simulation tests (incl. fairness matrix ~2 min)
npm run test:e2e     # 11 Playwright browser tests (starts its own server)
npm run budget       # asserts dist/ < 3 MB
npm run ci           # the whole gauntlet, in order
node scripts/capture-docs-shots.mjs   # regenerate this guide's screenshots
```

## What the suites cover

* **Unit** — fluid math (drag, terminals, integrator purity, mass scaling), input policies (blend, ramp, reversal, momentum caps), field implementations (falloff continuity, superposition, magnitude caps, time-determinism), spawner geometry, derivation functions, character cards, FSM, RNG.
* **Simulation** — feel targets (terminal sink 80–120 px/s, tap arc 40–120 px), determinism (same seed ⇒ bit-identical), the **golden master** (frozen Classic(Seal) trajectory), and the **fairness matrix** (reference bots × every mode × every creature × pace).
* **E2E** — real Chromium: boot→menu→play→die→retry loop, score & mute persistence, tab-hide pause, all three modes' input schemes (including right-click dive and keyboard).

## Conventions

* Tests are written *before* features close a gate (QA-first); gates only close with evidence written to `docs/DECISIONS.md`.
* The golden master regenerates **only** on an intentional, ADR-backed change: `GOLDEN_REGEN=1 npx vitest run tests/sim/golden-classic-seal.test.ts`.
* Deep links (`?play=1&mode=&character=&seed=&pace=`, `?scene=`) exist for tests and docs — keep them working.
