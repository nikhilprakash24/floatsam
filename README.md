# Underwater Flappy 🦭

Flappy, but underwater: **buoyancy, quadratic drag and momentum** replace the dry gravity-snap. One input (tap), procedural reef gates, one-hit death, score per gate.

Built per [ARCHITECTURE.md](ARCHITECTURE.md) (web-first, mobile-ready). Decisions and phase-gate evidence live in [docs/DECISIONS.md](docs/DECISIONS.md); the physics model in [docs/PHYSICS_SPEC.md](docs/PHYSICS_SPEC.md).

## Run

```bash
npm install
npm run dev          # http://localhost:5173
```

- `/?scene=sandbox` — physics sandbox: every `physics.json` constant on a live slider, FPS + telemetry.
- `/?seed=N` — deterministic obstacle stream (used by e2e).

## Test

```bash
npm test             # unit + sim suites (incl. 10,000-seed fairness sweep)
npm run test:e2e     # Playwright: boot/play/die/restart/persist/mute/pause
npm run ci           # the full local gate: typecheck → tests → build → budget → e2e
```

## Architecture in one paragraph

`src/core/` is pure TypeScript — no Phaser imports, fixed 1/60 s timestep, seeded RNG, fully unit-tested (≥80% coverage enforced). Phaser scenes are thin adapters that render interpolated sim state. All tuning lives in `src/config/*.json`. The `FluidField` interface is the seam for future current/vortex modes — Classic returns a constant buoyancy vector. Art is procedurally generated at boot (no assets to license). SFX are synthesized in WebAudio through a lowpass for the muffled underwater voicing.

## Deploy

CI (`.github/workflows/ci.yml`) builds, gates on the <3 MB budget, runs all suites, and deploys `dist/` to GitHub Pages on pushes to `main` (enable Pages → GitHub Actions in repo settings). The app is an installable, offline-capable PWA.
