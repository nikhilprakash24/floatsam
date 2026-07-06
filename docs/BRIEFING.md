# THE FLOATSAM BRIEFING
## Underwater Flappy / "Floatsam" — complete program handout

**Prepared:** 2026-06-14 · **Program state:** v0.6.0 + uncommitted audit · **Executor:** Claude Code (Fable 5; Phases 1–3 and most of P6 executed under Opus 4.8)
**Audience:** the owner, the planning/architecture chat, any future agent session, and any human collaborator joining cold. This document assumes **zero prior context**.

---

## 0 · How to read this

| You are… | Read |
|---|---|
| The owner wanting the 2-minute version | §1 only |
| Joining the project cold | §1–§5 |
| The planning chat updating the spec | §6–§9, §11 |
| A future agent session resuming work | §8 (exact position), §9 (next actions), §13 (reference) |
| Anyone deciding the mobile path | §10 |

Companion documents (all in `docs/`): `DECISIONS.md` (the ADR audit trail — the *why* for everything), `HANDOFF.md` (condensed status for the planning chat), `PHYSICS_SPEC.md` (formulas), `TEST_PLAN.md`, plus the full player/developer guide in `gitbook/`. This briefing is the superset narrative; those are the specialist views.

---

## 1 · Executive narrative — where we are, exactly

**The product:** a Flappy-Bird-genre 2D game whose core differentiator is *fluid dynamics* — buoyancy, quadratic drag, and momentum replace the dry gravity-snap. It has grown from a single-mode prototype into a **3-mode × 4-creature × 3-tempo game (36 playable combinations)**, each combination machine-verified fair, running at 60 fps in a 1.2 MB web bundle.

**The position (frozen frame, 2026-06-14):**

1. Everything through **Gate G6 is closed with evidence**: the full mode/character system shipped, and an **80,000-run fairness sweep passed with zero failures**. A Currents Lab (real vector-field fluid dynamics, visualized) and a third mode (Power Dive) are built beyond the original spec.
2. The codebase is **entirely local** — 16 commits, tags `v0.3.0` and `v0.6.0`, no remote. **The single blocking dependency for shipping is the GitHub connection**, paused mid-setup awaiting three answers from the owner (§11, Q1). The machine was verified clean of any cached GitHub credentials, so there is zero risk of the owner's separate thesis account being touched.
3. A **fresh full-code audit** (the first pass under Fable) just completed. It found **no correctness defects in the physics/fairness core** — the deep engineering is sound — but confirmed **13 findings** ranging from one real gameplay-balance bug to hygiene debt (§7). A fix batch was drafted and is **paused awaiting owner approval** (§9.1).
4. Nothing else is in flight. The game is playable right now via `npm run dev`; the original Classic(Seal) experience is provably bit-identical to what shipped at v0.3.0.

**The one-sentence status:** *feature-complete for a web beta, verification-heavy and honest about its debts, parked at the launch pad waiting for one login.*

---

## 2 · The product — full inventory

### Modes
| Mode | Input verb | Physics signature | Fairness status |
|---|---|---|---|
| **Classic** | tap to swim | net-sink buoyancy (~120 px/s terminal), 330 px/s stroke blended over 3 frames (~50 px arc) | 10k/10k per creature, **tuning-locked** |
| **Dive** | hold to rise / hold to dive | near-neutral buoyancy; thrust ramps 120 ms in / 180 ms out; visible momentum-fight on reversal | 10k/10k per creature |
| **Power Dive** | dive = down **and forward** lunge | free horizontal drift in a band + mass-scaled home-spring; lunge scales with creature power | ≥99% "advanced" bar (99.53–100%) by design |
| **Currents Lab** *(internal)* | free swim | authored vector fields (zones, vortices, superposition), fully visualized | invariant-bounded vs the weakest creature |

### Creatures (each = one JSON profile + one procedural sprite; zero engine code)
| # | Card | Rarity · OVR | mass / thrust / drag / buoy | hitbox | Identity |
|---|---|---|---|---|---|
| 01 | **Seal** | common · 59 | 1.00 / 1.00 / 1.00 / 1.00 | 19.2 | Locked baseline; the golden-master reference |
| 02 | **Otter** | rare · 71 | 0.70 / 0.70 / 0.84 / 0.90 | 14.0 | Weak flap, tiny target; the fairness system's anchor ("fair for the Otter ⇒ fair for all") |
| 03 | **Puffer** | uncommon · 48 | 1.40 / 1.18 / 1.30 / 1.16 | 26.0 | Barely sinks, turns badly, wide body |
| 04 | **Sea Lion** | epic · 44 | 1.35 / 1.40 / 1.15 / 1.00 | 24.0 | Heavyweight; monstrous Power Dive lunge |

### Everything else that exists
Tempo wrapper (×1.0/×1.2/×1.4, fairness-aware); trading-card character select with trait pips/OVR/rarity; per-(mode, creature) persisted best scores; multi-scheme input (touch halves, mouse left/right-click, keyboard ↑↓/WS/Space); synthesized underwater audio (zero audio assets, all WebAudio through a lowpass) with persisted mute; pause-on-tab-hide; PWA (installable, offline); procedural art (zero licensed assets); physics sandbox with live sliders; deep links to every screen and configuration (`?play=1&mode=&character=&seed=&pace=`, `?scene=`); a 13-chapter GitBook-ready documentation site with 12 auto-captured screenshots and a deterministic screenshot-regeneration script; CI pipeline (typecheck → tests → build → <3 MB budget gate → e2e → Pages deploy) that activates on first push.

---

## 3 · Program history, phase by phase

### Era 1 — ARCHITECTURE v2.0 (Phases 1–3, 2026-06-11 → 06-12) → tag v0.3.0
- **P1 · Foundation & physics sandbox (G1 ✅).** Pure-TS fluid core (integrator, drag, buoyancy, seeded RNG, fixed 1/60 s), sandbox with live sliders. *The founding crisis:* first tuning failed its own fairness sim in >99% of seeds — tap arc (~95 px) nearly equaled gap half-height, and drag made descents unrecoverable. Retuned to a ~50 px chainable stroke (ADR-004). **This produced the program's design law: underwater, descents — not climbs — are the binding fairness constraint.**
- **P2 · Classic complete (G2 ✅).** Spawner (pooled, seeded, fairness-clamped), collision, scoring, difficulty curve, full scene loop, persistence. First 10,000-run fairness sweep: clean.
- **P3 · Web polish (G3 ✅, 5 environmental deferrals).** Juice, synthesized audio, visibility pause, PWA, budget gate. Deferred (need cloud/devices): Lighthouse run, cross-browser matrix, prod domain, analytics, device soak.

### Interlude — planning round-trip
Handoff v1 went to the planning chat; it returned **ARCHITECTURE v3_3 "Floatsam"**: three modes, a character roster, phases 5–8, and hard process rules (bit-identical refactor gates, QA-first, ADR-before-deviation, Classic(Seal) tuning-locked).

### Era 2 — v3.3 execution + owner extensions (2026-06-13 → 06-14) → tag v0.6.0
- **ADRs 005–008** accepted the spec, amended the mass convention (`massScale` divides continuous forces only; thrust stays a Δv), left the name "Floatsam" OPEN, and corrected the spec's hitbox numbers against shipped truth (19.2, not 24).
- **Golden master frozen** — a 1,500-frame recording of the shipped Classic(Seal) run, covering scoring *and* death, as the bit-identical anchor.
- **P6 step 1 (gate ✅): GameMode refactor.** Integrator generalized (thrust Δv + massScale); tap logic → `TapUpPolicy`; Simulation consumes a GameMode. Golden reproduced exactly — provable because Seal's scales are 1.0 and `X·1.0 === X` in IEEE754.
- **P6 step 2 (gate ✅): CharacterProfile.** `deriveEffective(base × profile)`; Seal ≡ identity. Golden green again (the 19.2-vs-24×0.8 femtopixel question was tested and settled empirically — ADR-008 addendum).
- **P6 steps 3–4:** BiAxialPolicy (Dive), `clampsFor()` derived reachability, Dive mode, ModeSelect/CharacterSelect, keyed bests, deep links.
- **Owner playtest round 1:** locked the Dive input scheme (right-click dive, keyboard, touch halves — ADR-009); demanded more character contrast → trait cards, OVR, the Puffer, an amplified Otter (ADR-010).
- **Owner playtest round 2:** proper buttons everywhere; Currents Lab pulled forward from P7 *into the menu* (Zone/Vortex/Composite fields + FieldVisualizer + 5 presets, Otter-anchored safety invariants unit-tested); the Sea Lion; the tempo wrapper (ADR-011).
- **P6 step 5 (G6 ✅): the fairness matrix.** First probe: Classic Puffer/Sea Lion **0% pass** — strong flaps overshot Seal-geometry gaps. Fix: `gapScaleFor()` — **gap size derived per pair** (hitbox ratio × overshoot factor, enlarge-only, Seal ≡ 1.0). Result: **8 pairs × 10,000 seeds = 80,000 runs, 0 failures, min score 15/15** (ADR-012). Pace ×1.0/×1.2/×1.4 all clear.
- **Power Dive (ADR-013, owner-requested):** dive lunges down+forward; free-x body; the key physics fix was **mass-scaling the home-spring stiffness** so heavy creatures snap back instead of wallowing into pipes. Held to a documented ≥99% advanced bar. Explicitly built as **the seam for lateral currents** — a sideways current only matters once the player can move sideways.
- **Side quests:** Handoff v2 with Mermaid diagrams; a professional status artifact; the **GitBook guide** (13 chapters, 12 deterministic screenshots via `scripts/capture-docs-shots.mjs`, `.gitbook.yaml` Git-Sync-ready); `?scene=` deep links (verified by the capture run itself).

### Era 3 — the Fable audit (2026-06-14, this session)
Full fresh-eyes review of every layer. Outcome in §7; fix batch drafted, paused for approval. **No code has changed since tag v0.6.0 except documentation.**

---

## 4 · Architecture (technical summary)

**Prime rule:** `src/core/` has zero engine imports — pure, deterministic TypeScript. Phaser scenes are thin adapters rendering interpolated snapshots.

**Composition:** a run = `(GameMode × CharacterProfile × seed × pace)`.
- `GameMode` = data + two strategies: `InputPolicy` (input → thrust Δv: TapUp / BiAxial / PowerDive) and a `FluidField` factory (what the water does: Constant / Zone / Vortex / Composite / HomeSpring).
- `CharacterProfile` = one JSON of scale factors + hitbox + card metadata; `deriveEffective()` computes the run's constants once.
- **`FluidBody` is the only integrator**: `a = (gravity + buoyancy + field + drag) / massScale`, then `v += a·dt + thrustΔv`, asymmetric terminal clamps. Nothing else in the codebase mutates velocity.
- `GateSpawner` derives its own constraints per pair: `clampsFor()` (vertical reachability from real climb/sink rates, 0.75 safety) and `gapScaleFor()` (gap size from hitbox + overshoot). **Fairness is inherited by new content, not re-engineered.**

**Determinism** (fixed steps, seeded RNG, inputs at step boundaries) is the load-bearing property: it enables the golden master, 10k-run sweeps in seconds, shareable seeds, and — future — replay ghosts.

Diagrams: `gitbook/assets/diagram-architecture.svg`, `diagram-sim-loop.svg`; interactive versions in the status artifact; Mermaid in `HANDOFF.md`.

---

## 5 · The verification regime (what "tested" means here)

| Layer | Contents | Scale / cadence |
|---|---|---|
| **Golden master** | frozen Classic(Seal) trajectory, every field, every frame | every test run; regen only via `GOLDEN_REGEN=1` + ADR |
| **Unit** (11 files) | fluid math, integrator purity & mass semantics, all 3 input policies (blend/ramp/reversal/caps), all field types (falloff continuity, superposition exactness, magnitude caps, time-determinism), spawner geometry & pooling, derivations, cards, FSM, RNG | every run |
| **Simulation** | feel targets (terminal 80–120 px/s, arc 40–120 px), determinism, **fairness matrix** (reference bots × every pair; 1,500 seeds/pair committed; 10,000/pair as gate evidence), preset safety invariants | every run (~2 min) |
| **E2E** (11 tests) | real Chromium: full loop, restart <1 s, persistence, mute, tab-hide pause, select flow, right-click dive, keyboard both axes, Power Dive lunge | every PR / on demand |
| **Budget** | `dist/` < 3 MB (actual 1.20 MB) | CI |
| **Reference bots** | deliberately simple controllers (tap w/ 1-gate lookahead; bang-bang hold) — "if the dumb bot clears it, a human can" | harness in `tests/sim/fairness-harness.ts` |

**Current totals: 94 unit/sim + 11 e2e, all green at v0.6.0.** Known verification *gaps* are listed honestly in §7.3.

---

## 6 · Decision ledger (ADR digest — full text in DECISIONS.md)

| ADR | Decision | Standing consequence |
|---|---|---|
| 001–002 | v2.0 kickoff; environment adaptations (inline orchestration, procedural art, local preview) | procedural art = zero licensing until stores |
| 003 | forces are accelerations, mass ≡ 1; buoyancy via field seam | human-readable tuning JSON |
| 004 | tuning v2 after fairness failure | **the descents law** |
| 005 | v3.3 accepted | phase program of record |
| 006 | massScale divides continuous forces only | flap power ⊥ inertia as tuning axes |
| 007 | name "Floatsam" **OPEN** | blocks store assets only |
| 008 | Seal hitbox truth 19.2; Otter re-derived | spec corrected against shipped code |
| 009 | Dive input locked (multi-scheme) | owner-playtested |
| 010 | roster→3 + cards + OVR | roster growth pulled forward |
| 011 | Lab in menu; pace wrapper; Sea Lion; drift-invariant deferred to public Currents | Lab store-gating deferred to P8 |
| 012 | `gapScaleFor` — geometry derived per pair | **fairness by construction** |
| 013 | Power Dive; relaxed ≥99% advanced bar | currents seam exists |

---

## 7 · The Fable audit — findings register (2026-06-14)

**Headline: the physics, fairness, and determinism core audited clean.** Findings below are graded; none threaten the architecture.

### 7.1 Defects (verified in source, fix drafted, awaiting approval)
| ID | Finding | Severity | Impact |
|---|---|---|---|
| F-1 | **Keyboard key-repeat is unguarded** in Classic — holding ↑ produces OS-repeat flap spam → near-unlimited sustained climb for keyboard players | **Balance bug** | trivializes Classic on desktop; 1-line fix (`ignore e.repeat`) |
| F-2 | **Stale menu copy**: "2 modes · 4 creatures" — there are 3 modes | Cosmetic/trust | 1-line fix + screenshot regen |
| F-3 | **`window.__sim` debug hook allocates every frame** (object + filter + sort in the render loop) in *all* builds | Perf hygiene (matters for mobile) | gate on `?seed/play/debug` params; all e2e keep working |
| F-4 | **Legacy best score (`uf.bestScore`) never migrated** to the keyed system — pre-roster records invisible | Data loss (minor) | one-time Boot migration |
| F-5 | **`prefers-reduced-motion` never honored** (shake, flash, swaying rays) — was in the v2.0 G3 accessibility intent | Accessibility | gate effects on the media query |
| F-6 | **No PNG/maskable icons or apple-touch-icon** — SVG-only manifest degrades Android/iOS install experience | PWA/store prep | generate from icon.svg via script |

### 7.2 Hygiene & process debt
| ID | Finding | Note |
|---|---|---|
| H-1 | Coverage thresholds exist but **CI never runs `--coverage`** — the 80% floor is unenforced | enable after a local pass |
| H-2 | **No linter/formatter** (tsc-strict only) | ESLint flat + Prettier, optional |
| H-3 | Service-worker cache name static (`uwflappy-v1`) | bump-on-deploy policy note |
| H-4 | `ARCHITECTURE v3_3.md` has drifted from reality (2 modes/2 creatures on paper vs 3/4 shipped) | superseded via ADRs; a v4 consolidation doc is a planning-chat task |
| H-5 | FSM has no PLAY→MENU path — a future "quit to menu" pause button would violate it | extend FSM when that UI lands |

### 7.3 Known-and-accepted (documented, not scheduled)
- DEAD-phase body sinks through the seabed during slow-mo (cosmetic; hidden by the panel; fixing would churn the golden master — needs its own ADR if ever).
- Visual sprite sizes don't scale exactly with hitboxes (hitboxes are deliberately forgiving; standard genre practice; documented in the guide).
- Feel-target sims for Dive/Power Dive (§4.1 numeric targets: Otter tap-rate ratio, depth-hold ±40 px, reversal fight) **not yet committed** — the matrix proves *fair*, not *tuned-to-feel*. Scheduled (§9.2 S1).
- G7 human sign-off on Lab presets pending; Power Dive feel verdict pending (both need the owner's hands).
- G3 environmental deferrals stand until the push (Lighthouse, cross-browser, prod domain).

### 7.4 What the audit did *not* find
No integrator errors, no fairness-derivation holes, no determinism leaks (fields pure in (x,y,t); no `Date.now`/`Math.random` in core paths), no golden-master fragility, no dependency vulnerabilities (npm audit clean throughout), no security-relevant surface (no network I/O beyond static assets; localStorage only).

---

## 8 · Where we are EXACTLY — the frozen frame

```
Working tree : clean at commit 535d922 (GitBook guide), tags v0.3.0 · v0.6.0
Local only   : no git remote; no GitHub credentials on the machine (verified)
In flight #1 : GitHub connection — PAUSED awaiting owner (username / repo name / visibility)
In flight #2 : Audit fix batch F-1…F-6 + H-1 — DRAFTED, PAUSED awaiting owner approval
               (would land as v0.6.1, no breaking changes, full suite + screenshot regen as evidence)
Last delivered: this briefing · HANDOFF v2 · status artifact · GitBook guide (13ch/12 shots)
Playable now : npm run dev → localhost:5173 (all 36 combos + Lab + sandbox)
```

**Versioning policy (adopted):** pre-1.0 semver — *minor* = feature set or any behavior/save-format change (with migration notes), *patch* = fixes only, tag at every milestone, breaking changes named in the tag message and DELTA log. Golden-master regeneration always = ADR + minor bump.

---

## 9 · What needs to be done

### 9.1 · Immediate (this session, on approval)
**Fix batch → v0.6.1** (F-1…F-6, H-1, H-3): each item is scene/platform-level — **core untouched, golden master unaffected by construction**. Test evidence per item: full unit/sim suite, full e2e, coverage run, screenshot regeneration (F-2 changes the menu). Estimated: under an hour.

### 9.2 · The 2.5-day Fable sprint (compressed from v3.3's week-scale P5–P8)
| Sprint | Effort | Deliverable | Exit test |
|---|---|---|---|
| **S1 — Ship** | ~½ day | GitHub push → cloud CI → **public Pages URL**; GitBook space live; Lighthouse/PWA pass; **feel-sim suite committed** | CI green in cloud; URL playable on a phone; feel sims green |
| **S2 — Currents into gameplay** | ~1 day | current zones spawning inside Power Dive; telegraph visuals (Lab's arrow language); **fairness re-swept with currents active**; G7 owner sign-off | matrix incl. currents 0-fail at core bar; G7 ADR |
| **S3 — Public Currents mode** | ~½ day | 4th mode from graduated Lab presets, scored; matrix extension ×4 creatures | sweeps green; e2e select-flow updated |
| **S4 — Release candidate** | ~½ day | stats panel (per mode/creature/tempo); Windows-side store prep (icons, screenshots, privacy draft, **name brief**); full regression → **tag v0.9.0-rc**; Handoff v3 | `npm run ci` green; RC checklist in DECISIONS.md |

### 9.3 · Owner-gated (parallel, any time)
GitHub answers (unblocks S1) → store accounts + cloud-Mac lane → reference devices → name ratification → G7/Power-Dive playtest verdicts.

### 9.4 · Post-sprint program (v1.0 and beyond)
Mobile packaging (§10) → store submission (G8: 60 fps on iPhone SE-class + Pixel 6a-class, input latency <50 ms, battery <15%/30 min, 1-hr crash-free soak) → post-launch: leaderboards (keys already exist), daily-seed challenge, **replay ghosts** (nearly free thanks to determinism — record tap frames, race your best run), monetization v1.1 (stubs planned, launch clean), roster growth (creature = JSON + sprite + sweep), public Currents evolution.

---

## 10 · The mobile question (Capacitor vs Unity) — executive analysis

The owner's stated intent: *"eventually we will translate this perhaps via Unity to a mobile Android and iOS app."* Recommendation follows; decision is the owner's.

| Path | Cost | What you get | What you lose |
|---|---|---|---|
| **A · Capacitor** *(plan of record)* | days | same codebase; web stays the iteration arena; Android buildable on this Windows machine; iOS via cloud-Mac CI | WebView ceiling (irrelevant at 1.2 MB/60 fps with effect tiers already built) |
| **B · Unity port** | 2–3 weeks + permanent dual-codebase | native perf headroom, console/3D future, mature store tooling | web-first loop; the TS core (~600 deterministic lines re-implemented in C# against the same sim tests — the design carries, the code doesn't) |
| **C · Godot 4** | ≈ Unity cost, lighter runtime | open-source, good 2D | same rewrite economics |
| **D · Android TWA (PWABuilder)** | ~hours | Play-Store presence from the PWA alone — a free beta channel | Android only; thinner native feel |

**Recommendation: A, with D as an early beta channel, and Unity (B) kept as a criteria-triggered v2.0 decision, not a default.** Trigger criteria (proposed for ratification): sustained <45 fps on the reference devices after one optimization sprint, **or** an approved roadmap requiring 3D/console. This is also exactly what the v3.3 spec concluded (§8 contingency) — the audit found no evidence to overturn it, and the codebase was deliberately built so a Unity port stays cheap *if* triggered: pure core, documented formulas, JSON tuning, and the sim tests as a portable acceptance suite.

---

## 11 · Open questions for the owner (decision register)

| # | Question | Recommendation | Blocks |
|---|---|---|---|
| Q1 | **GitHub games account:** username? repo name? public/private? | `floatsam`, public (free Pages) | S1, everything downstream |
| Q2 | Approve fix batch v0.6.1 (§9.1)? | yes — F-1 is a real balance bug | audit closure |
| Q3 | Approve Plan v4 sprint order (§9.2)? or reorder (e.g., currents before ship)? | ship first — feedback loop needs a URL | S1–S4 |
| Q4 | Name: Floatsam / Glub / Deepling / other? | Floatsam (S4 prepares the trademark-check brief) | store assets |
| Q5 | Play the Lab presets + Power Dive (10 min): feel verdicts? | — | G7 close; PD tuning |
| Q6 | Unity trigger criteria (§10) ratified? | as written | v2.0 planning |
| Q7 | Analytics still dropped from v1.0? | yes | — |
| Q8 | Store accounts + cloud-Mac lane timing? | after web beta feedback | P8 |

---

## 12 · Insights & meta-commentary (what this program taught us)

**Engineering insights**
1. **Descents are the scarce resource underwater.** Quadratic drag makes shedding altitude slow; every correction stroke costs altitude budget. This single fact shaped tuning, level-generation clamps, Dive's existence, and current-safety budgets (down-currents get half the allowance of up-currents).
2. **Derive, don't tune.** Per-pair derivation (`clampsFor`, `gapScaleFor`) turned a combinatorial tuning burden (modes × creatures × tempos) into two pure functions. The 0%-pass Puffer probe → 100% fix took one function, not twelve tuning sessions.
3. **Determinism is a superpower, not a constraint.** Fixed timestep + seeded RNG bought: bit-exact refactor proofs, 80k-run verification in minutes, shareable seed challenges, deterministic documentation screenshots, and (future) free replay ghosts.
4. **The golden-master + identity-scales technique** made two frightening refactors mathematically safe: when every new multiplier is exactly 1.0 for the baseline, `X·1.0 === X` turns "hope nothing changed" into an arithmetic identity checked by a frozen fixture.
5. **Superposition breaks per-field caps** (twin-eddies lesson): safety invariants must be checked on the *composite* field over a dense grid, never per-component.
6. **Reference bots need human-like lookahead** to certify human-passable levels — the Dive bot's brake-tap momentum tail was stealing its own descent budget until it learned to read the next gate, exactly as a player does.
7. **Heavy bodies need mass-scaled restoring forces** (Power Dive spring): `a = F/m` means a constant-k spring lets heavy creatures wallow; scaling k by mass restores uniform *feel* across the roster.

**Process meta-commentary**
1. **Doc-driven agentic execution works.** A binding architecture doc + ADR-before-deviation + QA-first gates produced 16 commits with zero regressions and a complete audit trail. The two spec-correction moments (hitbox 19.2; roster drift) show the healthy failure mode: *code wins, ADR records, spec updates on the next planning round-trip*.
2. **Owner playtest is the highest-value input in the loop.** Every owner session (input schemes, character contrast, buttons, pace, "see the currents") produced better direction than any amount of agent extrapolation — and the spec had wisely reserved exactly those as playtest-locked decisions.
3. **The gates were never theater.** G6's first probe failed at 0% — the process caught a real, total unfairness before any human wasted an hour on it.
4. **What changes under Fable:** this audit pass (§7) is the first whole-system review; the honest finding is that the *core* was already sound and the debt is at the edges (input niceties, hygiene, accessibility) — which is itself evidence the gate discipline worked. Plan v4's main structural change is **ship-first**: a public URL turns every future decision into a feedback-driven one.
5. **Windows environment quirks are documented** (Node not on PATH — prefix `export PATH="/c/Program Files/nodejs:$PATH"`; git identity is a repo-local placeholder pending the games account; preview `launch.json` calls node.exe directly).

---

## 13 · Reference card

```
run          npm run dev                → http://localhost:5173
test         npm test (94) · npm run test:e2e (11) · npm run ci (everything)
budget       npm run budget             (dist < 3 MB; actual 1.20 MB)
screenshots  node scripts/capture-docs-shots.mjs
golden regen GOLDEN_REGEN=1 npx vitest run tests/sim/golden-classic-seal.test.ts  (ADR required!)
deep links   /?play=1&mode=dive&character=otter&seed=42&pace=1.2 · /?scene=lab|sandbox|pace|mode|character
versions     v0.3.0 (P1–P3) · v0.6.0 (P6/G6 + Lab + Power Dive) · next: v0.6.1 (fix batch) · v0.9.0-rc (sprint exit)
docs         BRIEFING (this) · HANDOFF · DECISIONS (ADRs+gates) · PHYSICS_SPEC · TEST_PLAN · gitbook/ (player+dev guide)
```

*End of briefing. Next action rests with the owner: Q1 (GitHub) and Q2 (fix batch) unblock everything scheduled.*
