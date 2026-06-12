# Underwater Flappy — Build Handoff to Planning/Architecture
**Version:** v0.3.0 (Phases 1–3 complete) · **Date:** 2026-06-12 · **Executor:** Claude Code (Fable 5)
**Plan executed:** ARCHITECTURE.md v2.0 (web-first, 4 phases) — this doc reports back against it.

This document is self-contained: it can be pasted into the planning chat without repo access. Full evidence trail lives in `docs/DECISIONS.md` (ADRs 001–004 + gate checklists G1–G3).

---

## 1. Executive status

| Phase | Gate | Status |
|---|---|---|
| 1 — Foundation & physics sandbox | G1 | ✅ Closed with evidence |
| 2 — Classic mode complete | G2 | ✅ Closed with evidence |
| 3 — Polish, audio, web release | G3 | ✅ Closed (local scope); 5 items deferred, listed in §6 |
| 4 — Mobile packaging & stores | G4 | ⏳ Not started — blocked on inputs from planning (§7) |

The game is fully playable end-to-end at the local preview URL: menu → play → death (300 ms slow-mo) → game over → <1 s restart, with persisted best score, audio, PWA install/offline, and a live-tunable physics sandbox at `/?scene=sandbox`.

**Quality posture:** 41 unit/sim tests + 6 Playwright e2e, all green. Core coverage 96.7% stmts / 89.4% branches (floor: 80%). Fairness: reference bot clears 15 gates in **10,000/10,000** seeded runs. Production build **1.17 MB** (budget 3 MB), ~327 KB gzip transfer. CI pipeline written (typecheck → unit/sim → build → budget gate → e2e → Pages deploy) — activates on first push to GitHub.

## 2. Stack as built (vs. plan)

Per plan: TypeScript strict, Phaser **3.90.0**, Vite 8 (Rolldown), Vitest 4, Playwright, localStorage behind a `KVStore` seam, GitHub Actions. Capacitor not yet added (Phase 4). `core/` has zero Phaser imports; fixed 1/60 s timestep with seeded RNG — identical inputs reproduce identical runs, which is what made the fairness sweep and e2e determinism possible.

**Deviations (all ADR'd):**
1. **ADR-002** — Roles executed inline by one orchestrating session rather than parallel subagents (greenfield coherence; §5 contracts preserved: tests-first, gates with evidence). Placeholder art is **procedurally generated** at boot instead of Kenney downloads (zero licensing/network; swappable like any sprite sheet). Preview URL = local Vite until a remote exists. npm initially resolved Phaser 4.1 — pinned back to 3.x per plan.
2. **ADR-003** — Force split: `FluidField.sampleForce` carries constant buoyancy (the §4.3 seam); `FluidBody` owns gravity/drag/swim. All forces are accelerations (mass ≡ 1) so tuning JSON stays human-readable.
3. **Audio is synthesized** in WebAudio (lowpass-muffled chirps/thuds + brown-noise ambient) — no audio assets exist. Decide later whether shipped v1.0 keeps synth or buys SFX.

## 3. The key engineering finding (planning should read this one)

**Underwater, descents — not climbs — are the binding fairness constraint.** First tuning (tap arc ≈ 95 px vs. gap half-height 105 px) failed the fairness sim in >99% of seeds: every mid-gap correction tap injects a full arc of altitude, and quadratic drag makes shedding altitude slow (terminal sink ~120 px/s with ~1 s ramp). Fix (ADR-004): smaller chainable tap (arc ≈ 50 px) + asymmetric spawner clamps — gates may step up to ~161 px upward between gates but only ~47–73 px downward. Any future retune of `swimImpulse`/`dragCoefficient` **must** re-run the 10k sweep (`npm test`). This asymmetry should inform Normal-mode level design too (currents that push down are much harsher than ones pushing up).

## 4. Current tuning (single source of truth: `src/config/*.json`)

**physics.json:** gravity 600 · buoyancyAccel 400 (net sink 200) · dragCoefficient 0.014 (terminal sink ≈ 119.5 px/s) · swimImpulse 330 blended over 3 frames (arc ≈ 50 px, peak ≈ 0.6 s) · maxRise 420 / maxSink 240 · rotationLerp 0.12, maxTilt 32° · hitbox 80%.

**difficulty.json:** world 480×720, player x=140 r=24 · scroll 130→210 px/s (+4/point) · gap 210→150 px (−2.5/point) · spacing 280 px · fairness clamps maxRise 100 / maxSink 45 px/s × 0.75 safety. Saturated difficulty (score ≈ 30+) is the practical skill ceiling — the frame-perfect reactive bot dies around score 50.

**Feel vs. plan §4.2:** terminal sink 119.5 (target 80–120 ✓); tap arc 50 px in 0.6 s — *gentler/finer than the original 60–140 px spec draft*; momentum carries (no velocity snap, e2e + sim verified). Side-by-side "reads underwater" check: subjective sign-off still with the owner; human playtest during the build reached best 31 and reported no feel complaints.

## 5. Repo map (what exists)

```
flappySeal/
├── ARCHITECTURE.md            # the v2.0 plan (unchanged)
├── README.md                  # run/test/deploy quickstart
├── docs/ DECISIONS.md         # ADRs 001–004 + G1/G2/G3 gate evidence ← audit trail
│        PHYSICS_SPEC.md       # formulas, derived numbers, tuning ranges, fairness coupling
│        TEST_PLAN.md          # layer matrix + gate checklists
│        HANDOFF.md            # this file
├── src/config/                # physics.json, difficulty.json (all tunables)
├── src/core/                  # pure-TS sim: fluid/, spawn/, score/, state/, sim/, rng
├── src/scenes/                # Boot, Menu, Game, Hud, GameOver, Pause, Sandbox
├── src/entities/ src/platform/  # PlayerView; KVStore, Haptics stub, SfxSynth
├── public/                    # PWA: manifest, icon.svg, sw.js
├── tests/ unit/ sim/ e2e/     # 41 + 6 tests, incl. 10k fairness sweep
├── scripts/check-budget.mjs   # <3MB CI gate
└── .github/workflows/ci.yml   # typecheck→test→build→budget→e2e→Pages deploy
```

Git: 3 commits + tag `v0.3.0`, one commit per phase boundary, local repo only (no remote yet; identity is a placeholder).

## 6. Deferred G3 items (environmental, not engineering)

Lighthouse ≥90 run · cross-browser matrix (real iOS Safari / Firefox) · 10-min heap soak on reference hardware · production domain deploy · analytics provider choice (needs an ADR when picked). All unblock when the repo is pushed + devices/accounts exist.

## 7. Decisions planning owes the build (Phase 4 inputs)

1. **GitHub remote** (org/repo name) — unblocks CI, Pages preview URL, cloud review. Also: correct git author identity.
2. **Store accounts**: Apple Developer + Play Console; iOS lane needs a Mac/Xcode (build machine is Windows).
3. **Reference devices** for the G4 benchmark gate (plan names iPhone SE-class + Pixel 6a-class).
4. **Analytics**: pick the privacy-light provider (or explicitly drop it from v1.0).
5. **Audio direction**: keep synthesized SFX or license real assets before store submission.
6. **Naming/branding**: working title "Underwater Flappy" is not shippable to stores ("Flappy" trademark risk) — needs a real name before store assets are made.

## 8. Suggested next milestone

Push → CI green in cloud → Pages URL public (closes most of §6) → Phase 4 per plan §6. Unity contingency (§9 of the plan) remains untriggered; nothing observed suggests it will be — desktop WebGL runs at 60 fps with effects on, and the effect-tier auto-reducer is already in place for weak WebViews.
