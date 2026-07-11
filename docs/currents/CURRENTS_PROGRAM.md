# Currents Program — Plan of Record

**Branch:** `currents-program` · **Status:** PLAN (awaiting owner sign-off on §9 forks + documentation-depth call)
**Owner ask (verbatim intent):** expand the Currents Lab to ~20 patterns; decide how currents enter the *actual game*; intuition that a whole-screen field "should be rare and seems less amenable to the game," with **modular** (rectangular / other-shaped) currents as the everyday unit — and possibly **both**. Plan first, then build on this branch.

---

## 0. TL;DR — the decision in three lines

1. **Do NOT insert a whole-screen field as the default.** In the scrolling game the player's x is fixed, so a screen-anchored field only ever touches one column — it becomes a time-only wobble, not a place you pass through.
2. **Primary game unit = localized *current cells*** (rect / circle / lane-segment / vortex / wedge) that **spawn in world-space and scroll left with the gates**, so you *travel into and out of* them exactly like gates. Modular, telegraphed, seeded, fairness-clamped.
3. **Whole-screen currents = a rare timed *Surge* event** (a few seconds, ramps in/out, always escapable). The owner's instinct is correct: keep it rare and dramatic, not the baseline. **We use both — cells as the grammar, surges as the punctuation.**

---

## 1. The core tension (why this plan exists)

The current engine has one seam: `FluidField.sampleForce(x, y, t) → {x, y}` acceleration, summed into `FluidBody` (`a = (gravity + buoyancy + field + drag)/massScale`). Two facts about how it's sampled today:

| | **Currents Lab (free-swim)** | **The scrolling game** |
|---|---|---|
| Player x | roams the whole 480 px width | **fixed at `playerX`** (Classic/Dive); a narrow band in Power Dive (`freeX`) |
| Field frame | screen == world (static) | screen is static, **the world scrolls left** past the player |
| What a 2D field gives you | the full spatial picture — vortices, lanes, pockets you fly *around* | only the **slice at `playerX`** — spatial x-structure is invisible; you feel currents only as `f(y, t)` |

So a beautiful 2D Lab field, dropped into the game unchanged, collapses to a 1-D column. To make currents *spatial* in the game — things you approach, enter, and leave — they must **live in world coordinates and move**, i.e. scroll like gates. That reframing is the whole plan.

**Consequence:** currents in the game are a *spawned, scrolling* system parallel to the gate spawner — not a static field handed to the mode. The Lab keeps the static 2D field (it's a showcase/design surface); the game gets a `ScrollingField` adapter that presents world-space cells to the *same* `sampleForce` seam. **`FluidBody` never changes. Classic stays untouched (golden-locked).**

---

## 2. One primitive set, two products

```
                       FluidField primitives (pure, deterministic, tested)
                       rect · circle · lane · vortex · wedge · pulsing · turbulence · travelling
                                   │                                   │
          ┌────────────────────────┘                                   └───────────────────────┐
   CURRENTS LAB (showcase)                                        THE GAME (play)
   static 2D field, free-swim                                     ScrollingField: world-space cells
   ~20 named patterns + gallery                                   scroll left with gates + rare Surge
   FieldVisualizer arrows/tracers                                 in-play telegraph (arrows/particles/tint)
   design & tuning surface                                        fairness-swept, budget-clamped
```

The Lab is where the 20 patterns are authored, visualized, and balanced. The game consumes a **curated subset** of those patterns, re-expressed as scrolling cells + surge events.

---

## 3. Shape & primitive taxonomy

**Already built** (`src/core/fluid/fields/`): `ZoneField` (rect | circle, smoothstep edges), `VortexField`, `LaneField` (depth-banded), `CenterSeekField`, `PulsingField` (time gate), `TurbulenceField` (deterministic value-noise), `SlipstreamField` (travelling pocket), `CompositeField`, `BudgetClampField` (the fairness governor), `HomeSpringField`.

**New shapes to add** (all pure `f(x,y,t)`, all with smoothstep falloff — no force cliffs):

| Shape | Purpose | Notes |
|---|---|---|
| **Capsule / lane-segment** | a *finite* tailwind/headwind lane (a lane with ends, so it can be a cell) | rounded-rect intensity mask |
| **Ring / annulus** | vortex "wall" you thread; whirlpool rim | radial band around a center |
| **Wedge / ramp** | lift that grows along its length — a launch ramp | triangular intensity |
| **Radial source / sink** | boil (push out) / drain (pull in) | pure radial dir, circle mask |
| **Gradient band** | smooth cross-shear (dir rotates with depth) | for shear steps |

Shapes are the *geometry*; direction + strength + time-gate are orthogonal modifiers. Any shape × any modifier is legal — that's how 20 patterns come from a handful of primitives.

---

## 4. The 20-pattern catalog

Classification: **H**elpful (gives what the medium denies — lift/tailwind/stability) or **X** hostile (taxes a budget). **Scope:** `cell` = localized & scrolls into play · `screen` = rare full-field event · `lab` = showcase-only set-piece. Every entry is authored in the Lab; the **Game** column marks what ships into play.

| # | Name | Shape | H/X | Scope | One-liner | Game |
|---|------|-------|-----|-------|-----------|------|
| 1 | **Updraft Vent** | rect ↑ | H | cell | Free lift column — ride it up. | ✅ |
| 2 | **Downwash** | rect ↓ | X | cell | A sinking column; power through or go around. | ✅ |
| 3 | **Crosscut** | rect → | X | cell | Lateral shove; only bites in free-x. | ✅ (PD) |
| 4 | **Sidewinder** | circle ↘ | X | cell | Diagonal gust knocks your line. | ✅ |
| 5 | **Boil** | radial-out | X | cell | Pushes you off its center every way. | ✅ |
| 6 | **Drain** | radial-in | X | cell | Sucks toward a point — fight outward. | ✅ |
| 7 | **Eddy (CW)** | vortex | X | cell | Clockwise swirl; lean against the spin. | ✅ |
| 8 | **Eddy (CCW)** | vortex | X | cell | Mirror of 7. | ✅ |
| 9 | **Whirl Pair** | 2× vortex | X | lab→cell | Counter-rotating pair with a shear seam between. | ▲ |
| 10 | **Gyre** | large vortex | ~ | lab | Slow ocean-scale rotation; ambience. | lab |
| 11 | **Tailwind Lane** | capsule → | H | cell | A depth band that carries you forward. | ✅ |
| 12 | **Headwind Lane** | capsule ← | X | cell | The toll lane; costs forward budget. | ✅ (PD) |
| 13 | **Shear Step** | gradient band | X | cell | Cross a line where flow flips. | ▲ |
| 14 | **Geyser** | pulsing rect ↑ | H* | cell | Lift, but only on the beat — time the breath. | ✅ |
| 15 | **Breathing Wall** | pulsing rect | X | cell | An on/off barrier of force you must time through. | ▲ |
| 16 | **Slipstream Pocket** | travelling capsule | H | cell | A moving tailwind bubble — catch it and fly. | ✅ |
| 17 | **Roaming Eddy** | travelling vortex | X | cell | A vortex that wanders across your path. | ▲ |
| 18 | **Calm Eye** | center-seek circle | H | cell | A stabilized safe pocket in rough water. | ✅ |
| 19 | **Launch Ramp** | wedge ↑ | H | cell | Lift that ramps up along its length. | ✅ |
| 20 | **The Surge** | whole-screen turbulence + drift | X | **screen** | RARE storm: the whole column heaves for ~3–5 s. | ★ rare |

✅ ships as a cell · ▲ candidate (needs fairness proof) · ★ rare event · lab = showcase only.

> This is a proposal, not frozen. #10/#9/#13/#15/#17 are the "less amenable to a fixed-x scroller" ones — they stay Lab-first and only graduate to `cell` if they survive the fairness sweep. #20 is the owner's "whole thing," deliberately singular and rare.

---

## 5. Game-insertion architecture

### 5.1 Localized cells (the everyday unit)

New core module, mirroring `GateSpawner`:

```
CurrentCell   = { kind, shape, worldX, y, size…, params, telegraph }   // seeded at spawn
CurrentSpawner(cfg, rng, budgets)                                       // pooled, deterministic
    .update(dt, score)   // worldX -= scroll·dt ; recycle off-screen ; pick next kind by seeded table
    .field(scrollX)      // → FluidField adapter
```

`ScrollingField implements FluidField`: on each `sampleForce(bodyX, bodyY, t)` it maps the body into each live cell's local frame (`localX = bodyX − cell.worldX`), sums the cells' contributions, and returns the total — then hands the sum through **one** `BudgetClampField`. The `Simulation` already owns a `field`; we just construct this adapter when the mode opts in. **No change to `FluidBody`, `stepBody`, the game loop, or Classic.**

- **Deterministic:** cells come from the same seeded RNG discipline as gates → replay/golden/fairness all hold.
- **Placed around gates, not on them:** cells spawn in the *gaps between* gate columns (or keyed off a gate's gap center) so a cell never makes a gate physically impossible — it makes it *harder to hold your line*, which is the fun.
- **Telegraphed:** every cell renders a lead-in (drifting particles / arrow glyphs / faint tint) before it reaches the player. Fairness *requires* readability — no unavoidable surprise shoves.

### 5.2 Whole-screen Surge (the rare event)

A `SurgeEvent` is a time-boxed whole-field `FluidField` (e.g. `Turbulence + a global drift`) that a scheduler switches on rarely (see §9 for rate), ramps up over ~0.6 s, holds ~3–5 s, ramps down. It composes over whatever cells are active and passes the same budget clamp. It gets a screen-wide telegraph (vignette pulse + "current incoming" cue + heavier particle field). **It can shove, never instakill** (recommendation — owner call in §9).

### 5.3 Which modes carry currents?

| Mode | Cells | Surge | Rationale |
|---|---|---|---|
| **Classic** | ❌ | ❌ | Tuning-locked, golden master. Never. |
| **Dive** | optional | ❌ | Fixed-x; cells work but lateral ones are wasted. Low priority. |
| **Power Dive** | ✅ primary | ✅ | `freeX` band means lateral/vortex cells actually matter — currents were *designed* as its endgame (see project memory). |
| **New "Currents" public mode** | ✅ | ✅ | A dedicated home for the graduated catalog, so currents aren't bolted onto PD's identity. |

**Recommendation:** build cells in **Power Dive** first (the seam already exists), then spin the curated set into a **standalone "Currents" mode** as the public showcase. Owner decides in §9.

---

## 6. Fairness & determinism (non-negotiable)

- **Budget clamp everywhere:** the summed field (cells + surge) is clamped to the weakest creature's escape budget (`BudgetClampField`, anchored to Otter, as Fable Currents already does). Intensity can rise; *escapability cannot fall below 1.0*.
- **New fairness sweep:** extend the 80k-run matrix (8 pairs × modes) to the currents mode(s). A new **golden master** freezes one currents run per the QA-first rule. Classic's golden is untouched and re-verified green each increment.
- **Reachability vs currents:** the gate `clampsFor` reachability math assumes only the player's own thrust. Cells add force, so the sweep must prove the *combined* system stays escapable — this is the real gate (G-Currents), not a formality.
- **Telegraph as a fairness input:** unreadable currents fail the design bar even if numerically escapable. Readability is part of "fair."

---

## 7. Visualization & readability

- **Lab:** reuse `FieldVisualizer` (flow arrows + tracer particles) for all 20 patterns; add a **gallery/catalog UI** — pick a pattern, see it live with knobs, read its H/X + note. This is the "expanded Currents Lab."
- **Game telegraph:** lightweight, per-cell — advected particles that follow the cell's flow, an arrow decal, and a subtle water-tint delta. Surge gets a screen cue. All telegraph honors `fxLow` / reduced-motion tiers.

---

## 8. Phase plan (this branch)

Each phase merges to `main` only when green (suite + golden + typecheck), matching the finale cadence.

| Phase | Deliverable | Gate |
|---|---|---|
| **C0** | This plan + ADR-014 (currents = scrolling cells + rare surge; Classic exempt) | owner sign-off on §9 |
| **C1** | New shapes (capsule, ring, wedge, radial, gradient-band) + unit + purity/determinism tests | tests green |
| **C2** | 20-pattern Lab catalog + gallery UI (viz + knobs per pattern) | visual review |
| **C3** | `CurrentCell` / `CurrentSpawner` / `ScrollingField` adapter — **Lab-harnessed & unit-tested first** (no gameplay yet) | determinism + purity tests |
| **C4** | Cells live in Power Dive; in-play telegraph; **extended fairness sweep + currents golden** | G-Currents (sweep 0 fails) |
| **C5** | Rare whole-screen Surge event + scheduler + rarity model; fairness under surge | sweep green incl. surge |
| **C6** | Curated "Currents" public mode (if chosen), feel sims, tuning, polish, ship + tag | owner eyeball |

---

## 9. Open decisions (owner) — please resolve before C1

1. **Home for game currents:** Power Dive only · new standalone "Currents" mode · both · also Dive? *(recommend: PD first → standalone Currents mode)*
2. **Catalog size:** exactly 20 as listed · fewer high-quality · more? Any must-haves / cuts?
3. **Cell density:** how thick? (rare garnish ≈ 1 per 3–4 gates · moderate ≈ 1 per 2 · dense field). *(recommend: moderate, ramping with score)*
4. **Surge rarity & lethality:** how rare (e.g. ≤1 per 60–90 s, never back-to-back)? Can a surge *kill*, or only shove? *(recommend: rare, shove-only)*
5. **Difficulty coupling:** are currents a *mode* property, or a **global intensifier knob** (like Pace) layerable on modes? *(recommend: mode property now; global knob later)*
6. **Classic exemption:** confirm currents NEVER touch Classic (keeps the golden lock). *(recommend: confirm)*

## 10. Risks & mitigations

- **Fairness blow-up** (cells + thrust jointly unescapable) → budget clamp per-frame + mandatory sweep; cells spawn *between* gates, never inside a gap's kill zone.
- **Readability** (invisible shoves feel cheap) → telegraph is a first-class deliverable, not polish.
- **Determinism drift** (cells break replay/golden) → cells use the same seeded pooled discipline as gates; adapter is pure; golden covers a currents run.
- **Scope** (20 patterns × game integration is large) → Lab-first (C1–C2) is shippable value on its own; game integration (C3+) is independently gated so we can stop at any green phase.

---

*Authored on branch `currents-program`. Documentation depth for the broader program docs is owner-calibrated next; this file is the plan skeleton it will hang from.*
