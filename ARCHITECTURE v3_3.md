# Floatsam — Architecture & Build Plan v3.3
## Consolidated spec · Three modes · Choosable characters · Phases 5–8 · Agentic execution

**Proposed name: "Floatsam"** (working title; ocean + buoyancy pun on *flotsam* — "float" names the core mechanic, no "Flappy" trademark exposure). Repo/codename stays `flappySeal` until the owner ratifies and clears trademark + domain (§7.6). Alternates on the table: **Glub**, **Deepling**.

**Audience:** Claude Code / CLI agents executing the project end-to-end.
**This is a self-contained consolidation** of v2.0 (executed, Phases 1–3 closed), v2.1/v3.0/v3.1 (planning iterations) and v3.2 (mode+character consolidation); v3.3 adds the proposed product name. It folds the **three-mode design** and the **character system** into a single coherent spec so no cross-version chasing is needed. Where this doc and the shipped v0.3.0 code disagree, this doc directs the change; where it and the code's own ADRs disagree on already-built Classic, **the shipped code wins** (Classic is locked).
**Ground truth:** the v0.3.0 codebase per HANDOFF.md — Phases 1–3 closed with evidence (41 unit/sim + 6 e2e green, core coverage 96.7/89.4, 10k/10k fairness, 1.17 MB build).

---

## 1. Product Definition

A 2D underwater game whose **core differentiator is fluid dynamics** — buoyancy, quadratic drag, momentum. One fluid core serves **three modes**, each playable by any character in a **selectable roster**.

### Modes
| # | Mode | Player verb | Fluid field | Audience | Status |
|---|---|---|---|---|---|
| 1 | **Classic** | Tap to swim up; buoyancy/drag/momentum do the rest. Flappy-simple. | Constant (net sink) | Public, launch | ✅ Built & tuning-locked |
| 2 | **Dive** | Bidirectional — actively swim **up AND dive down**; hazards demand both. | Constant, near-neutral buoyancy | Public, launch | Build in P6 |
| 3 | **Currents Lab** | Free swim inside authored current zones & vortices; flow visualization + live tuning. | **Vector field** (the real FluidField) | **Internal — us, testing currents.** `?lab=1` dev flag. | Build in P7 |

Currents Lab is our testbed; it graduates into a public "Currents mode" post-launch (§9). Classic + Dive ship to stores; the Lab is compiled out of store builds.

### Characters
A character is a **physics profile + hitbox + sprite/pose set**, chosen before play, valid in every mode. The roster is pure data — new creatures are JSON + sprites with zero engine work.

| Character | Identity | Physics intent | Status |
|---|---|---|---|
| **Seal** (default) | The original | Baseline = today's locked tuning (all scales 1.0) | ✅ is the current game |
| **Otter** | Smaller, lighter, less powerful | Lower mass (snappier), **weaker flap/thrust**, smaller hitbox (threading buff), lower terminals → nimble-but-fragile | Build in P6 |

Platforms: **web first** — every merge deploys a playable URL; this is the public building arena. iOS/Android via Capacitor in P8 with both public modes × both characters. Unity remains a benchmark-triggered contingency only (§8) — handoff evidence (60 fps desktop WebGL, effect-tier auto-reducer in place) makes it unlikely.

---

## 2. Stack — frozen as built

TypeScript strict · Phaser **3.90** (pinned <4) · Vite 8 (Rolldown) · Vitest 4 — core coverage floor 80%, actual 96.7/89.4, **don't regress below 90/85** · Playwright e2e (480×720) · `KVStore`/`Haptics` platform seams · synthesized `SfxSynth` · procedural placeholder sprites · CI: typecheck → unit/sim → build → budget(<3 MB) → e2e → Pages deploy. **Capacitor 6 enters in P8 only.** Physics = Phaser Arcade + our custom fluid layer; the vector field is our own pure-TS math (no Matter.js).

---

## 3. Core architecture

### 3.1 Binding rules (all agents, non-negotiable)
1. `src/core/` has **zero Phaser imports** — pure, deterministic, unit-tested. Scenes adapt core via thin views.
2. All tunables live in `src/config/*.json`. No magic numbers in code. Tuning = JSON diff with one-line rationale, hot-reloaded in dev.
3. Fixed **1/60 s** timestep + seeded RNG → identical inputs reproduce identical runs. Determinism is keyed per **(seed, mode, character)**.
4. **FluidBody is the only integrator.** Every force source (gravity, drag, buoyancy, field, thrust) returns an acceleration; nothing else mutates velocity. (Per shipped ADR-003: mass ≡ 1 baseline; §3.4 adds a per-character `massScale` divisor under ADR-006.)
5. A **mode** is data + two strategy objects (InputPolicy + FluidField). A **character** is one data profile. Adding either must not touch FluidBody, the Game scene loop, or locked Classic files.
6. Currents Lab never appears in public/store menus (build-flagged).

### 3.2 Composition: GameMode × CharacterProfile
```
GameMode      { id, inputPolicy, field, spawnProfile, scoringRules, hazards? }
CharacterProfile {
  id, name, spriteSet,
  massScale,      // FluidBody integrates a = F / massScale
  thrustScale,    // scales swimImpulse (Classic) and T_up / T_down (BiAxial) — "flapping power"
  dragScale,      // scales dragCoefficient
  buoyancyScale,  // scales buoyancyAccel
  hitboxRadius    // per-character, replaces fixed r=24 / 80% rule
}
```
The Game scene takes `(GameMode, CharacterProfile)`. Effective constants (terminal velocities, tap-arc height, ramp times, spawn clamps) are **derived** from the pair at load and logged to PHYSICS_SPEC.md by a script — never hand-maintained.

### 3.3 Input policies (`src/core/input/`)
- **TapUpPolicy (Classic):** tap → upward impulse (330 accel) blended over 3 frames; momentum preserved, never velocity-set. *Wraps existing shipped behavior unchanged.*
- **BiAxialPolicy (Dive & Lab):** hold upper screen half → upward thrust `T_up`; lower half → downward thrust `T_down` (dive). Thrust ramps in ~120 ms (ease-out), decays ~180 ms on release; never sets velocity. Sprite pitch follows velocity (damped lerp); dive gets a nose-down pose. Start `T_up 700 / T_down 520` (dive.json). Because descents are the scarce resource (§3.5), `T_down` is the headline force. *Thumb-drag alternative prototyped in sandbox; locked by playtest ADR before G6.*
- Momentum-preservation property test covers **both** policies.

### 3.4 Fluid fields (`src/core/fluid/fields/`) — `sampleForce(x,y,t) → accel Vec2`
- **ConstantField** — Classic (0, −200 net sink) · Dive (0, ≈−25 near-neutral).
- **ZoneField** — rect/circle volume; direction d̂, strength s (accel), smoothstep edge falloff over a ≥24 px band (no force cliffs). `F = d̂·s·falloff(p)`.
- **VortexField** — center c, radius R; tangential profile `s·(r/R)` inside (solid-body), smooth decay outside; optional small radial inflow; capped at `fieldMaxAccel`.
- **CompositeField** — Σ children (superposition). All fields **pure in (x,y,t)**; any animation driven by **sim time only** → replay-drift CI test guarantees determinism.

### 3.5 Descent asymmetry — design law (from shipped ADR-004 + handoff §3)
Underwater, **shedding altitude is the binding fairness constraint**: terminal sink ≈ 119.5 px/s with ~1 s ramp, so down-corrections are slow. The shipped spawner clamps reflect this (~161 px up vs 47–73 px down between gates). v3.2 generalizes the consequence:
- **Dive mode exists to solve this** — active `T_down` gives players the descent the medium denies them.
- **Per-character, per-mode clamps are derived, not assumed:** a pure unit-tested function `clampsFor(character, mode)` computes spawn clamps from that pair's arc/terminal/ramp with the shipped **0.75 safety factor**. Same seed ⇒ *different layouts per character*; fairness stays correct by construction.
- **Field safety invariants are anchored to the weakest rostered character (the Otter):** up/lateral field accel ≤ 0.8 × weakest effective `T_up` (≥20% headroom); **down field accel ≤ 0.5 × weakest effective `T_down`** (half budget, because descents are scarce); a no-input drifting body in any authored preset never exceeds 1.4× its passive terminal sink. Fair for the Otter ⇒ fair for everyone.
- Any retune of values Classic(Seal) consumes requires an ADR + a fresh **10k fairness sweep**.

### 3.6 Repository map (★ = new in this consolidation; rest exists at v0.3.0)
```
flappySeal/
├── ARCHITECTURE.md  HANDOFF.md
├── docs/ DECISIONS.md  PHYSICS_SPEC.md  TEST_PLAN.md
├── src/
│   ├── main.ts
│   ├── config/
│   │   ├── physics.json  difficulty.json            # shipped base (Classic/Seal)
│   │   ├── modes/ classic.json dive.json★ currents-lab.json★
│   │   └── characters/ seal.json★ otter.json★
│   ├── core/
│   │   ├── modes/ GameMode.ts★
│   │   ├── input/ InputPolicy.ts★ TapUpPolicy.ts★ BiAxialPolicy.ts★
│   │   ├── character/ CharacterProfile.ts★
│   │   ├── fluid/ FluidBody.ts FluidField.ts  fields/{Constant,Zone★,Vortex★,Composite★}Field.ts
│   │   ├── spawn/  score/  state/  sim/  rng/        # spawn adds clampsFor()★
│   ├── scenes/ Boot Menu ModeSelect★ CharacterSelect★ Game Hud GameOver Pause Sandbox
│   ├── entities/ PlayerView      platform/ KVStore Haptics SfxSynth
│   └── debug/ FieldVisualizer.ts★
├── public/ (PWA: manifest, icon, sw.js)
├── tests/ unit/ sim/ e2e/        scripts/check-budget.mjs      .github/workflows/ci.yml
```

---

## 4. Feel, fairness & test targets

### 4.1 Targets by mode × character
- **Classic(Seal):** LOCKED — arc 50 px, terminal sink 119.5, asymmetric clamps as shipped. Changes = ADR + 10k re-sweep.
- **Classic(Otter):** arc 42–46 px; "lighter but busier" — bot tap rate 1.15–1.35× Seal's at equal difficulty (sim-measurable); survives its own 10k sweep with otter-derived clamps.
- **Dive (both characters):** neutral drift ≤ 15 px/s; full-hold reaches terminal ≈ 0.4 s **both directions**; reversal shows ~0.25 s momentum fight; depth-hold ±40 px for 5 s after one minute (PD bot, then human); per-character down-clamps from each `T_down`.
- **Currents Lab (both):** zone crossing never Δv > 25% terminal per frame; a vortex visibly bends a drifting path; both asymmetric invariants hold for the Otter; seeded Lab replay drift = 0.

### 4.2 Otter starting profile (sandbox-tuned before any sweep)
`massScale 0.80 · thrustScale 0.72 · dragScale 0.90 · buoyancyScale 0.95 · hitboxRadius 19`
Intent: weaker single flap must be *felt*; ~21% smaller threat circle is the compensating buff. Seal = all 1.0 / r 24 → **bit-identical to current behavior** (this is the refactor gate).

### 4.3 Test strategy (extends the shipped layers)
| Layer | Tool | Adds in v3.2 |
|---|---|---|
| Unit | Vitest | CharacterProfile derivation, `clampsFor()`, each field impl (sampling, falloff continuity, superposition, cap, asymmetric invariants), both input policies |
| Sim | Vitest (headless core) | Per-(mode×character) determinism & feel targets; **fairness matrix = 10k seeded runs per pair** (P6: Classic/Dive × Seal/Otter = 4 sweeps); field replay-drift |
| E2E | Playwright | ModeSelect + CharacterSelect flows; Dive loop; per-(mode,character) best-score persistence |
| Perf | Playwright + CDP | unchanged budgets; both modes at P8 device gate |
Coverage floor 80% on `src/core/` (enforced). Don't drop below 90/85 from the as-built high-water mark.

---

## 5. Agentic team

Roles & contracts as shipped (ADR-002 inline orchestration **ratified** — single session, but the tests-first discipline is mandatory: each gate's acceptance tests are committed before that gate's feature work).
- **Orchestrator:** ADRs for input-scheme lock, select-flow shape, Lab-in-store handling; gate evidence into DECISIONS.md.
- **Physics:** CharacterProfile math + derived-constants script; field implementations + invariant tests; PHYSICS_SPEC.md.
- **Gameplay:** GameMode root, input policies, `clampsFor()`, Dive spawn profile + hazards, per-(mode,character) scoring & sweeps.
- **UI/Scene:** ModeSelect + CharacterSelect, dive poses, Otter procedural sprite set (Seal-consistent style), FieldVisualizer + Lab tuning panel.
- **QA:** parameterized sim/fairness/e2e matrices, field unit matrix, regression guarding locked Classic(Seal).
- **DevOps:** dev-flag gating of Lab, per-mode/store build config, cloud Mac lane (P8), unchanged pipelines.

---

## 6. The four remaining phases

### Phase 5 — Ship the web build · ~2–3 days · owner-gated
GitHub remote + git identity → push, cloud CI green, Pages live → production URL + PWA verify → deferred G3 checks (Lighthouse ≥90, cross-browser iOS Safari/Firefox, 10-min heap soak; record honestly if hardware missing) → analytics ADR (**default: drop from v1.0**).
**Gate G5:** public URL live with Classic(Seal); cloud CI green; environmental checks done or waived by ADR. *P6 starts in parallel immediately — only the public URL depends on this phase.*

### Phase 6 — Mode system + Characters + Dive · ~5–7 days
1. **GameMode refactor** (Classic extracted, zero numeric change) → **gate: full suite incl. 10k sweep green, bit-identical seeded replays.**
2. **CharacterProfile** with Seal ≡ 1.0 → **second bit-identical gate.**
3. Input policies → otter.json + dive.json tuned in sandbox; `clampsFor(character, mode)`.
4. Dive spawn profile (varied-height gaps + top/bottom hazard bands forcing bidirectional play; independent difficulty curve); ModeSelect + CharacterSelect flow; best scores keyed (mode, character).
5. **QA-first:** derived-constants & clamp tests, Classic(Otter) + Dive(×2) feel sims, **4× 10k fairness sweeps**, input-policy property tests, e2e for both selects; Classic(Seal) full regression.
**Gate G6:** Dive end-to-end and Otter selectable in both modes at the public URL; 4 sweeps 10k/10k; input-scheme + select-flow ADRs locked; Classic(Seal) bit-identical.

### Phase 7 — Currents Lab (internal) · ~3–4 days, overlaps P6 tail
Fields + unit matrix (sampling, falloff continuity, superposition, caps, **otter-anchored asymmetric invariants**, time-determinism) → Lab scene behind `?lab=1` (free swim, FieldVisualizer flow arrows + advected particles, tuning panel writing currents-lab.json, ≥4 presets incl. one deliberately downcurrent-heavy stress preset, **in-Lab character switcher** — testing currents against both bodies is the point) → seeded record/replay with **zero drift** in CI.
**Gate G7:** invariants green for the weakest character; ≥3 presets tuned with human sign-off that currents feel right; findings ADR'd as the spec seed for the future public Currents mode.

### Phase 8 — Mobile packaging & stores · ~5–7 days · owner-gated
Owner inputs first (§7) → Capacitor 6 iOS/Android; KVStore→Preferences, native Haptics (light on score, heavy on death), safe-areas, keep-awake, status bar hidden; Lab compiled out (ADR). **Device benchmark gate:** 60 fps sustained across both modes (spot-checked both characters) on iPhone SE-class + Pixel 6a-class; input→thrust latency < 50 ms; battery < 15%/30 min. One optimization sprint allowed; second failure → Unity contingency (expected: never). Audio/art ship decision executed; store assets (roster featured as a listing asset); privacy policy, ratings, submit. Monetization stays stubbed to v1.1.
**Gate G8:** both store submissions accepted; release regression green; 1-hour crash-free soak per device.

---

## 7. Owner decision register (none block P6/P7)

| # | Decision | Planning default | Blocks |
|---|---|---|---|
| 1 | GitHub remote + git identity | Private repo now | G5 |
| 2 | Store accounts + Mac lane | Apple $99/yr + Play $25; cloud Mac CI lane (Codemagic / GitHub macOS runners) since build machine is Windows | P8 |
| 3 | Reference devices | iPhone SE-class + Pixel 6a-class | G8 |
| 4 | Analytics | Drop from v1.0 (revisit at monetization) | G5 ADR |
| 5 | Audio & art | Synth/procedural for web launch; license real SFX + hero sprites for **two** characters before stores | G8 |
| 6 | **Name** | **Proposed: "Floatsam"** (alts: Glub, Deepling). Owner ratifies + runs trademark/domain/store-search check before store assets. Codename `flappySeal` stays until then | G8 |
| 7 | Character unlock model | **Both free at v1.0** (roster is the selling point); unlock monetization = a v1.1 ADR, no lock UI built now | none |

---

## 8. Risks & contingency

| Risk | Mitigation |
|---|---|
| Refactor/character work breaks locked Classic(Seal) | Two consecutive bit-identical replay gates + full 10k sweep before any new-feature code |
| Otter ends up strictly better or worthless | Sim balance proxy (bot survival + tap-rate §4.1) before human playtest; tune the **character** JSON, never mode curves |
| Fairness-matrix cost creep | Sweeps are seeded, headless, CI-parallel; `clampsFor()` keeps fairness derived → new characters cost tuning, not redesign |
| Down-currents unfair for weak characters | 0.5×T_down invariant anchored to Otter, enforced in unit tests now |
| iOS lane on Windows build machine | Cloud Mac CI lane chosen in §7.2 before P8 |
| Owner gates stall critical path | All owner-gated work isolated in P5 (small) and P8 (end); P6/P7 are owner-independent |

**Unity contingency:** trigger only if the P8 device gate fails after one optimization sprint. `core/` is pure TS with documented formulas + JSON tuning, so a port re-implements ~600 deterministic lines against the same sim expectations; design, tuning, fairness data, art, store assets all carry over. Insurance, not expectation.

---

## 9. Post-launch trajectory
v1.1 monetization (rewarded continue, remove-ads; optional character unlocks per ADR) → v1.2 **public Currents mode** grown from Lab presets + G7 findings → roster growth (each creature = JSON + sprites + per-mode 10k sweeps; distinct mass/drag/thrust profiles) → leaderboards (per mode+character keys already in place).

---

## 10. Kickoff instructions for Claude Code
```
1. Read this file + HANDOFF.md. Append ADR-005 (acceptance of v3.3 consolidation +
   ratification of shipped ADR-001..004), ADR-006 (massScale amendment to the
   mass≡1 convention), and ADR-007 (product name — record "Floatsam" as proposed,
   left OPEN pending owner ratification + trademark/domain clearance; do NOT rename
   the repo/package/bundle-id yet).
2. Begin Phase 6 immediately — it's owner-independent. Order is fixed:
   GameMode refactor (bit-identical gate) → CharacterProfile w/ Seal≡1.0
   (bit-identical gate) → input policies → Dive + Otter tuning + sweeps.
   Execute Phase 5 items as the owner unblocks them. Phase 7 may overlap once the
   BiAxialPolicy lands.
3. QA-first: each gate's acceptance tests are committed before its feature work.
   Gates close only with evidence (test output, sweep results, preview URL, human
   sign-off where specified) written to docs/DECISIONS.md.
4. Classic(Seal) is tuning-locked: any change to values it consumes needs an ADR +
   full 10k re-sweep. Otter/Dive/Lab tuning lives in their own JSON and never edits
   locked files.
5. Any deviation from this document requires an ADR before code.
```

*Document version 3.3 — consolidated three modes (Classic ✅ / Dive / Currents Lab) + choosable characters (Seal baseline, Otter light·agile·weak-flap) + proposed product name "Floatsam". Prepared for agentic execution.*
