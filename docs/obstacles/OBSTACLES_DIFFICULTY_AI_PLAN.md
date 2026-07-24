# Obstacles, Difficulty & AI — Plan of Record

**Branch:** `currents-program` · **Status:** PLAN (post-adversarial-review; corrected)
**Provenance:** synthesized from a 23-agent design workflow — 5 subsystem maps, 4 parallel designs (difficulty / obstacles / AI / testing), each adversarially verified through 3 lenses (determinism · fairness · integration). The verification returned **major-flaws** on 3 of 4 designs; this document is the corrected architecture that resolves every `mustFix`.

---

## 0. TL;DR

We are adding, on top of the currents engine, four **obstacles** (sea mines, fissure/steam vents, bottom flora, top fish-hooks), a **methodical difficulty curve**, an **AI/bot system**, and **sandbox + free-play testing** — all opt-in, default-off, golden-safe, and fairness-preserving *before* we add more characters (characters are then designed to answer the map).

**The one decision that changes everything (from the review):** *fairness by construction* cannot be delivered by force clamps + bot sweeps. It requires an explicit **Reachable Corridor solver** — a constructed, provably-flyable tube that every hazard is placed outside of. The AI becomes a *falsifier* that tries to break the guarantee, never the guarantee itself.

---

## 1. The keystone: the Reachable Corridor (fairness by construction)

The review's central verdict (agents a35178, ae0a33, a59d40, a07df5): *"per-piece budget clamps do NOT compose into joint corridor feasibility… a bot clearing 10k seeds is sampling, not a proof."* So we build the proof, not just measure it.

**1.1 The Safe Spine.** The gate-gap-center chain is already a reachability-clamped random walk (`Spawner.ts:nextGapCenter`, bounded by `clampUp·t`, `clampDown·t`). Promote it to a first-class **spine** `y_spine(slot)`: a monotone-reachable path whose slope between slots is bounded by the **per-dimension weakest** character's clamps. The spine is the single source of truth every system references.

**1.2 The Safe Tube.** Around the spine, a tube of half-height
`h(slot) = maxHitboxRadius + margin + driftBudget(slot)`
where `driftBudget` = worst-case body displacement from currents **and any active surge** integrated over the time the body occupies that x-band. The tube is the **dynamically flyable envelope** — not merely a geometric interval (fixes the "geometric ≠ dynamical reachability" mustFix): a body entering at a clamp-consistent velocity can stay inside it.

**1.3 Co-schedule, don't independently spawn.** Gates, current cells, and obstacles share **one x-slot grid** (same spacing/offset). *Kind and parameter selection* use separate seeded RNG streams (so the gate stream stays byte-identical — Seal golden safe), but *x-positions lock to the grid*. This kills the temporal-desync / stale-co-solve flaw: the gate an obstacle meets is deterministic, decided at the same slot.

**1.4 Placement rule.** Every hazard footprint is placed **outside the tube**, against the **union** of all footprints in an x-band (fixes the pincer / combined-occupancy mustFix — seaweed-bottom + hook-top must jointly leave the tube clear). Two guarantees, kept separate (fixes the "clamp covers collisions" over-claim):
- **Kill hazards** (mine, hook barb+shaft, fissure plume while erupting): **positional exclusion** from the tube. This is the guarantee for lethal geometry — the force clamp does nothing here.
- **Force hazards** (currents, flora drag, fissure updraft): bounded so net drift inside the tube ≤ the tube's `driftBudget`, via **one** shared clamp (below).

**1.5 Multi-dimensional weakest.** `WEAKEST` is derived per dimension across the roster — `min(clampUp)`, `min(clampDown)`, `min(thrust)`, `max(hitboxRadius)` — not one "weakest character" (fixes the Otter-hardcode + one-dimensional-order mustFix). A test asserts every character stays ≥ these floors; a future character below a floor fails the test, never the player. The clamp constants (today `OTTER.thrustScale` inline at `Simulation.ts:123`) are replaced by a computed `WEAKEST` in `character/weakest.ts`.

**1.6 The AI is a falsifier, not the proof.** The corridor solver *is* the guarantee. The obstacle-aware rollout bot (§4) tries to find a counterexample; a bot failure **escalates** search (branch/depth/horizon) or falls back to the geometric proof before it is ever reported as "unfair course." This resolves the "empirical fairness wearing a constructive label" verdict.

**Module:** `src/core/fairness/corridor.ts` — pure, deterministic, no Phaser, no RNG of its own. `spineAt(slot)`, `tubeAt(slot)`, `placeOutsideTube(footprints, rng)`, `isReachable(footprints)`. Unit-tested against constructed adversarial layouts.

---

## 2. Difficulty-curve methodology

An owner-authored curve drives a **pressure budget** allocated across knobs, so total felt difficulty is *designed*, not the accidental sum of independently-ramping systems.

**2.1 Pipeline.** `curve(progress) → P∈[0,1] → budget allocation → per-knob values`, character-relative, pure `f(progress)`.

**2.2 Corrections from review (all mustFix):**
- **Distinct config path.** New config at `config/difficulty-curve.json` — **never** overwrite the shipped, tuning-locked `config/difficulty.json` that `classicMode.spawn` and 15 files consume (agent abbbafa).
- **Disabled path = literal delegation.** When `enabled:false`, `knobsAt` returns the *exact* `scrollSpeedFor`/`gapSizeFor` outputs by calling them directly — no curve/lerp re-derivation (IEEE754 divergence would break the Seal golden). No knobs-object allocation on the disabled path (no per-frame GC on the golden path).
- **Swap all 5 scroll-speed sites, or none.** `scrollSpeedFor`/`gapSizeFor` are read at `Spawner.ts:84` (reachability `t`), `:101` (makeGate), `:113` (movement), `:121` (recycle), and `Simulation.ts:239` (cell scroll). When enabled, all route through `knobsAt`; the reachability window and cell scroll must use the *same* speed or the clamp desyncs.
- **Single gapScale site.** `knobsAt` returns the RAW gap; the existing `* this.gapScale` at `Spawner.ts:101/:121` stays — never both (double-scaling diverges non-Seal default-off runs).
- **Config validation** at load: budget weights sum > 0, ranges finite, curve monotone in x, progress clamped — or NaN flows into gate positions.
- **`currentIntensity` is a texture knob, not a peak knob.** It saturates against the shared clamp (agent a08d3ca, abbbafa): once cells saturate, raising intensity doesn't raise peak force. Peak pressure comes from **spacing / kind-mix / gap**, not intensity. It needs real plumbing: a live intensity provider multiplied *inside* `ScrollingCurrentField.sampleForce` before the clamp (not baked in `buildCellField`), fed the current `progress` each tick.
- **`obstacleMix` needs non-proportional ranges** (agent abbbafa): equal `[0,x]` ranges lerped by one `pk` give a constant ratio for all P>0. Author mix as absolute shares that shift with P.

**Modules:** `src/core/difficulty/{curve.ts, budget.ts, Difficulty.ts, validate.ts}`. `Difficulty.knobsAt(progress)` is the single pure entry point.

---

## 3. Obstacle system + the four obstacles

**3.1 Abstraction.** `src/core/obstacles/{Obstacle.ts, ObstacleSpawner.ts}` — one pooled scroller mirroring `GateSpawner`/`CurrentSpawner`, **co-scheduled on the gate x-grid** (§1.3), own RNG stream `createRng((seed^0xC2B2AE35)>>>0)`.

**Corrections (mustFix):**
- **Compound collision.** A hook is a shaft (rect) **and** a barb (circle) — a single `mask` enum can't express it (agent a07df5). `Obstacle.footprints: Footprint[]` (each `rect|circle`), all tested in `hitsObstacles()`.
- **Construction order.** `ObstacleSpawner` is built **after** `GateSpawner` (after `Simulation.ts:153`), so pool-fill co-solve sees real gates (agents a1820ee, ae0a33) — not the 117-151 block.
- **One shared clamp.** Surge + obstacle fields compose into **one** `CompositeField` passed as the **single** `extra` of the **one** `ScrollingCurrentField` → one `{upMax,downMax,latMax}` governs the total. Never two `ScrollingCurrentField`s (that sums two clamped outputs → ~2× the budget, an escapability hole — agents a1820ee, ae0a33, a07df5).
- **Hoist clamp constants** out of the currents-on branch so obstacles-on/currents-off has defined budgets.
- **Off-gate like currents.** Obstacles off ⇒ zero force contributor in the composite and zero collision loop ⇒ field byte-identical (golden safe).

**3.2 The four obstacles**

| # | Obstacle | Collision | Motion | Emits current? | Decision |
|---|----------|-----------|--------|----------------|----------|
| 1 | **Sea mine** (spiked ball) | circle | static (scroll only) | no | Simplest; positional-exclusion from tube. Always lethal, telegraph = visible spikes. |
| 2 | **Fissure / steam vent** | rect **only while erupting** | static, seabed-anchored | **yes — updraft** | The synthesis (below). |
| 3 | **Bottom flora** (seaweed/coral) | **soft** (no `die()`) | render-only sway | yes — mild **up/lateral** drag | Positional tax, not a fail state. **Pushes up/away from the floor, never +vy** (a +vy at the seabed is a kill-assist — agent a07df5). |
| 4 | **Fish hook** (top) | compound rect+circle | **stationary** (optional slow deterministic pendulum) | no | Stationary confirmed: free-x already supplies spatial challenge; a moving hook needs a 3rd motion stream + re-proof and creates updraft→barb traps (agents a23394, a07df5). |

**3.3 Fissure synthesis — corrected (this is the flagship mechanic).**
- **Updraft strictly wider than the kill plume.** `buildZoneUpdraft` half-width **>** plume kill half-width, with a dead-zone over the plume, so the lift lives in a **lift-but-not-kill annulus beside** the plume — otherwise "ride beside, not through" is false and it's a death trap (agents ae0a33, a07df5 both flagged `buildZoneUpdraft(rectW,…)` overlapping its own kill rect).
- **Updraft never load-bearing.** Removing the updraft must still leave the tube flyable — the weakest character is never *forced* adjacent to an active plume (agents ae0a33, a59d40). Corridor solver enforces this.
- **FSM = {idle, ramp, erupt}** derived **purely from `t`** (like `PulsingField`/`geyser`), not a mutable `active` boolean sampled a tick late (agents a1820ee, a07df5). `maskNow='none'` during ramp (telegraph shows the growing plume, collision unarmed), `'rect'` only during erupt. Field gate is a **smoothstep ramp**, not a 0→1 step (a sudden shove under a hook is the exact trap — agent a07df5).
- **Per-fissure seeded phase offset** so vents don't erupt in lockstep and recycles don't reset to phase 0.
- **Updraft on the reachable side only** — never opposes the required descent direction of the corridor (agents a35178, abbbafa, a59d40).

**3.4 Characters reflect the map.** Relativity propagates to **obstacle padding AND field magnitude**, not just gate width (agent a35178): a low-thrust character gets wider anti-corridor padding and the corridor solver seats its tube where the map's lift helps. New characters are then designed to lean into features (a heavy diver that rides updrafts; a nimble one that threads hooks) — the obstacles create the design space, per the goal.

**3.5 Free-x is phase 2.** Obstacles ship first in **fixed-x Dive** (1D tube, provable). Free-x **Power Dive** obstacles wait behind a **2D corridor solver** that proves a *lateral* route past each obstacle given the x-band + home-spring + lunge (agent ae0a33: vertical-only co-solve omits the flagship's whole point). De-risks the hardest case.

---

## 4. AI / bot system

`src/ai/` — a pure input source outside the sim (never imports `FluidBody`, never on the shipping path). `Controller.decide(view) → AiInput`; a `drive.ts` adapter feeds the same tap/hold events a human produces (no branch in `tick()`).

**Corrections (mustFix):**
- **Field is not `f(x,y,t)`-pure across time.** Currents/surge are *stateful scrolling* (agents af1cfcfd, a59d40). The rollout's `ShadowSim` must sample the field at the **correct simulated `t` per rollout tick** by advancing a **deterministic clone of the spawners** — not a frozen snapshot (which steers into scrolled-in currents), not a live-spawner mutation (which breaks determinism). Planner-vs-sim field agreement is a validated invariant.
- **Two planners, clear roles.** Greedy (O(1), current pre-comp + hazard bias) for cheap demo/idle; rollout mini-MPC (exploits the cheap deterministic sim) where timing/lateral choice matters. **The bot is a falsifier** (§1.6) — never the fairness guarantee.
- **Horizon ≥ fissure burst period + 2-height cycle + drift traversal** (agent a59d40) — a 0.3 s horizon can't phase-plan a burst.
- **Hard reproducibility invariant:** Controllers use only the injected `reset(seed)` stream, never `Date.now`/`Math.random`; AI RNG salt ≠ `0x9e3779b9`/`0x85ebca6b`/`0xC2B2AE35`. A test asserts bit-reproducibility across two runs.
- **Frozen-matrix protection:** the ported greedy `Controller` must reproduce the current inline `classicShouldTap`/`diveHold` **decision sequences bit-for-bit**, not just pass the threshold (agent af1cfcfd) — else the 80k matrix silently shifts.
- **`SimView` hands out frozen/copied arrays**, not live `spawner.gates` refs (TS `readonly` is compile-time only).

---

## 5. Sandbox + free-play testing

`src/core/testlab/` (pure `difficultyProbe.ts`, zero Phaser — shared verbatim between Vitest and the scene) + `src/scenes/TestLabScene.ts` (on the existing DOM-panel sandbox shell) + a `?freeplay=1` flag on `GameScene`.

- **The probe is the shared truth:** scene "Run N", CI test, and `fairness-matrix` all build the sim through one `TestConfig.toSimArgs()` and drive it with the **same** harness bots → no scene/test drift.
- **Budget meter = live fairness proof:** HUD shows pre-clamp Σ|field| vs `{upMax,downMax,latMax}`; if a fissure-updraft ever redlines >1.0 the probe clear-rate drops below the ADR-013 gate and `difficulty-probe.test.ts` fails.
- **Free-Play** via a `die()`-site guard (no tick reorder): `if (freePlay.noDeath) { nudgeOutOfObstacle(); return; }` + a difficulty scrubber. Default-off ⇒ `GameScene` byte-identical.
- **Obstacle-aware validation:** the fairness bots today track only `gapCenterY` and are blind to obstacles (agents ae0a33, a07df5 — the headline "0 failures with obstacles=true" is *vacuous* with a gate-only bot). Validation uses the corridor **geometric proof** as the guarantee + the **obstacle-aware rollout** as the falsifier.

---

## 6. Unified config (all new, distinct paths)

`config/difficulty-curve.json` · `config/obstacles.json` · `config/ai.json` · `config/testlab.json`. Every fork is a knob; `modes.<id>.{obstacles,currents,surge}` default `false` ⇒ byte-identical. **None** touch shipped `difficulty.json`/`physics.json`/`modes/*.json`.

---

## 7. Phased build plan (each merges only when suite + golden green)

| Phase | Deliverable | Gate |
|---|---|---|
| **O0** | This plan + status/meta docs | — |
| **O1** | `difficulty/` pure module (curve/budget/Difficulty/validate) + `difficulty-curve.json` + tests; disabled==legacy proven; **not yet wired** | golden untouched (no sim edits) |
| **O2** | `character/weakest.ts` (per-dimension floor) + `fairness/corridor.ts` (spine/tube/placement) + adversarial-layout tests | corridor proof tests green |
| **O3** | `obstacles/` abstraction + `ObstacleSpawner` co-scheduled to gate grid + `ScrollingObstacleField` folded via the single shared `extra`; **sea mines** only; collision `hitsObstacles()` | off ⇒ byte-identical; mines pass corridor proof |
| **O4** | Fissure (FSM + wider-than-kill updraft + telegraph), flora (soft up/lateral), hooks (compound) — **fixed-x Dive first** | corridor proof per obstacle |
| **O5** | Wire `Difficulty` into all 5 scroll sites (enabled path) + `currentIntensity` plumbing | Seal golden bit-identical |
| **O6** | AI: `Controller`/`SimView`, greedy (parity-gated to current bots), rollout + `ShadowSim`, obstacle-aware falsifier | 80k matrix bit-identical; obstacle falsifier finds 0 |
| **O7** | Test Lab scene + `difficultyProbe` + free-play + budget HUD | probe==matrix baseline |
| **O8** | Free-x (Power Dive) 2D corridor + obstacles; feel-tuning; full obstacle fairness sweep | G-Obstacles sweep |

---

## 8. Fairness & determinism guarantees (the contract)

1. **Off ⇒ byte-identical.** Every new system gates like the currents seam; disabled paths delegate to legacy code; the Classic(Seal) golden master is the merge gate for every phase touching the sim.
2. **Four separate RNG streams:** gates `seed`, cells `^0x9e3779b9`, surge `^0x85ebca6b`, obstacles `^0xC2B2AE35`; AI salt distinct again. Gate stream never consumed by others.
3. **One clamp governs total force** (currents+surge+obstacle-fields), anchored to the per-dimension weakest character.
4. **Kill geometry is positionally excluded** from the constructed tube; force is drift-bounded within it. Two guarantees, never conflated.
5. **Construction is the proof; the AI falsifies.** No fairness claim rests on a finite seed sample.

---

## 9. Open decisions (owner)

1. **Obstacle debut mode:** fixed-x **Dive** first (recommended, provable), then free-x Power Dive — confirm?
2. **Flora lethality:** soft (recommended) vs a hard variant later?
3. **Fissure:** steam (non-lethal shove?) vs lava (lethal) — I've specced lethal-while-erupting; want a non-lethal "steam" variant too?
4. **Hook motion:** stationary (recommended) vs optional slow pendulum — ship static first?
5. **How many obstacles per screen** at peak difficulty (density cap)?
6. **Surge during obstacle bands:** suppress (recommended, simplest constructive rule) vs size the tube to absorb it?

## 10. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | Corridor solver is the hardest new code; a bug = unfair *or* impossible courses | Pure module, adversarial-layout unit tests, AI falsifier as second net; ship fixed-x 1D first |
| R2 | Free-x 2D reachability is genuinely hard | Deferred to O8 behind its own solver; obstacles ship in Dive first |
| R3 | `currentIntensity` saturation misleads tuning | Documented as texture-not-peak; peak via spacing/mix/gap |
| R4 | Scope (8 phases) | Each phase independently green-gated and shippable; O1/O2 are pure modules with zero game risk |
| R5 | Future character below the weakest-floor breaks the clamp | `weakest.ts` + a test that fails on any character under the floor |

---

*Companion: docs/currents/CURRENTS_PROGRAM.md · this plan supersedes the ad-hoc obstacle notes. Authored from workflow run wf_b58683e9-c0c (23 agents; verification caught the fairness-by-construction gap before implementation).*
