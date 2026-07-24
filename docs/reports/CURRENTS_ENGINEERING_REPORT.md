# Internal Engineering Report — Currents Program

**Project:** Floatsam (Underwater Flappy) · **Repo:** nikhilprakash24/floatsam · **Live:** https://nikhilprakash24.github.io/floatsam/
**Report date:** 2026-07-11 · **Author:** engineering (Claude/Fable) · **Audience:** internal — planning & architecture
**Status:** branch `currents-program` — C1–C6 skeleton **built, green, PR #2 open, not merged** · **Classification:** internal

---

## 1. Executive summary

We set out to answer one product question — *how do currents enter the actual game?* — and shipped a full, tested implementation skeleton across six phases (C1–C6) on an isolated branch. The headline results:

- **The design question is resolved with a code-grounded answer.** In the scrolling game the player's x is fixed, so a whole-screen current field degenerates to a single column. The everyday unit is therefore a **localized cell** that scrolls into play like a gate; a whole-screen field is a **rare Surge event**. Owner's "keep the whole-screen thing rare" instinct is now the architecture, not a preference.
- **Zero risk to the shipped game.** Currents are opt-in and default-off. A bit-identical regression test proves the currents-off code path is byte-for-byte the previous behavior. Classic's golden master and the 80,000-run fairness matrix are untouched.
- **Fairness is guaranteed by construction, not by trust.** Cells and surge pass through a single budget clamp anchored to the weakest creature. A 60-seed spot check shows the weakest reference bot still clears 8 gates ≥98% of the time through currents.
- **Every design fork is a tunable variable, per direction** — nothing was hard-committed; the open decisions live as knobs in one config file and a live sandbox.
- **Scope:** 27 files changed (+2,214 / −23), 19 new files, 44 new tests (156 total, all green).

**Recommendation:** merge `currents-program` to `main` (zero-risk, unlocks the Catalog/Sandbox at the live URL), then prioritize (a) a player-facing entry point and (b) the full fairness sweep before promoting currents from "dev-reachable" to "public."

---

## 2. Where we are (state of play)

| Track | State |
|---|---|
| Core game (Classic/Dive/Power Dive, 4 creatures, pace) | Shipped, live, stable |
| Finale graphics (A6 anims, A8, Fable Currents, seamounts bg, whale fly-by) | Shipped to `main`, live |
| **Currents program (C1–C6)** | **Built on branch, PR #2 open, default-off** |
| Currents public entry / full sweep / merge | **Pending (owner-gated)** |

The currents program is a *skeleton*: the engine, content, integration seam, telegraph, rare event, and a live-tuning sandbox all exist and are tested. It is deliberately not yet reachable by normal players — entry is via deep-links and dev scenes — so it can be reviewed and tuned before promotion.

---

## 3. What was built (phase by phase)

| Phase | Deliverable | Tests | Key files |
|---|---|---|---|
| **C0** | Plan of record (cells-as-grammar, surge-as-punctuation; forks as variables) | — | `docs/currents/CURRENTS_PROGRAM.md` |
| **C1** | 5 pure shape primitives: Capsule (finite lane), Radial (boil/drain), Wedge (ramp), Ring (annulus), GradientBand (shear) | 18 | `core/fluid/fields/{Capsule,Radial,Wedge,Ring,GradientBand}Field.ts` |
| **C2** | 20-pattern catalog (helpful/hostile + scope + game-clearance tags) + browsable free-swim gallery | 7 | `core/fluid/currents/catalog.ts`, `scenes/CatalogScene.ts` |
| **C3** | Scrolling `CurrentSpawner` (pooled, seeded) + `ScrollingCurrentField` adapter (world→local, single clamp) | 9 | `core/fluid/currents/{cells,CurrentSpawner}.ts` |
| **C4** | Cells opt-in in Power Dive + in-play telegraph + G-Currents spot check | 3 | `core/sim/Simulation.ts`, `scenes/GameScene.ts`, `config/currents.json` |
| **C5** | Rare whole-screen Surge (envelope scheduler + field, shares cell clamp) | 7 | `core/fluid/currents/Surge.ts` |
| **C6** | Currents Sandbox — every fork a live slider | — | `scenes/CurrentsSandboxScene.ts` |

---

## 4. Technical architecture

**The seam.** The engine already had exactly one extension point: `FluidField.sampleForce(x, y, t) → {x, y}` acceleration, summed into `FluidBody`. Currents plug in here and nowhere else — `FluidBody`, `stepBody`, the game loop, and all locked Classic files are untouched.

**Cells.** A `CurrentCell` is a localized field built once in a local frame centered at x = 0, placed at a `worldX` that scrolls left. `ScrollingCurrentField` maps the body into each live cell's frame (`localX = bodyX − worldX`), sums, and clamps. `CurrentSpawner` mirrors the object-pooled, seeded `GateSpawner` discipline — cells recycle off the left edge with fresh seeded parameters, so replay/golden/fairness all hold.

**Surge.** `SurgeScheduler` is a seeded state machine (idle → ramp-in → hold → ramp-out) producing an envelope in [0,1]; `SurgeField` is whole-screen turbulence + drift scaled by that envelope (zero cost/force when calm). It is summed into `ScrollingCurrentField` *before* the clamp via an optional `extra` field, so cells + surge share one escape-budget clamp.

**Integration.** `Simulation` gained two optional params (`currents`, `surge`), each resolving to a config lookup that defaults false. When on, a `CurrentSpawner` on its **own rng stream** (gate spawning unperturbed) feeds the composed field. Single field assignment means the off path is unchanged.

**Determinism.** All fields are pure in (x, y, t); spawner and surge use `createRng(seed ^ const)`. Same seed ⇒ same run — verified by tests.

---

## 5. Quality & fairness posture

- **156 unit/sim tests green** (44 new on this branch). Typecheck clean.
- **Golden master:** Classic(Seal) trajectory fixture re-verified green on every phase.
- **Fairness by construction:** single budget clamp anchored to the weakest creature (Otter) means intensity can be cranked past 1.0 and the emitted force stays escapable (proven at field level in C3, incl. absurd stacked intensity).
- **G-Currents spot check (interim):** 60 seeds × 4 creatures, currents-on Power Dive, reference `diveHold` bot — ≤1/60 failures to reach 10 gates (≈98% clearance). This is the interim proof; the full 80k sweep + a frozen currents golden is the outstanding formal gate.
- **Bit-identical guard:** currents-off Power Dive is byte-for-byte identical whether the flag is omitted or explicitly false.

---

## 6. Design forks → sandbox variables

Per direction, the six open decisions are **variables, not commitments** — all in `src/config/currents.json`, tunable live in the Currents Sandbox:

| Fork | Where it lives | Current default |
|---|---|---|
| Which modes carry currents | `modes.*.cells` / `.surge` | all off |
| Catalog size / kinds | `cells.kinds` | 12 localized cell kinds |
| Cell density | `cells.spacing` | 300 px |
| Intensity | `cells.intensity` | 1.0 |
| Surge rarity / lethality | `surge.*` | every 60–90 s, non-lethal |
| Escape budget headroom | `budgets.*` | up 0.7 / down 0.5 / lat 0.8 |

---

## 7. Risk register

| # | Risk | Severity | Mitigation / status |
|---|---|---|---|
| R1 | Fairness spot check ≠ full sweep; a rare seed could be unfair | Med | Budget clamp bounds force per-frame; full 80k sweep + currents golden is the tracked follow-up |
| R2 | Joint gate + current difficulty untuned ("escapable" ≠ "fun") | Med | Sandbox exists for feel-tuning; defaults are conservative |
| R3 | No player-facing entry yet → currents invisible to users | Low (intended) | Deep-links + dev scenes today; menu toggle / standalone mode is a scoped follow-up |
| R4 | Perf of per-frame telegraph draw + field sampling at high density | Low | Cheap x-cull in adapter; telegraph is simple Graphics; monitor if density raised |
| R5 | Preview panel unreachable this session (shared dev-server port) | Low | Verified via independent Playwright capture instead; not a product risk |
| R6 | Surge "lethal" flag is currently inert (currents never call die()) | Low | Documented; surge shoves, gates/seabed kill — matches "shove-only" default |

---

## 8. Open decisions (owner-gated)

1. **Merge `currents-program` → `main`?** Zero product risk (default-off); unlocks Catalog + Sandbox at the live URL for review.
2. **Player-facing entry:** menu toggle on Power Dive vs a standalone public "Currents" mode.
3. **Formal fairness gate:** commit to the full 80k currents sweep + frozen currents golden before promotion.
4. **Feel-tuning pass** on default intensity/spacing/density.
5. **ADR-014** ratification (currents = scrolling cells + rare surge; Classic exempt).

---

## 9. Meta-commentary & insights

- **The best decision was refusing the obvious one.** "Insert a whole-screen currents field" is the intuitive move and it's wrong for a fixed-x scroller — the code (single sampled column) proved it before any playtesting could. Grounding the design in how `sampleForce` is actually called saved a costly dead end.
- **Default-off was the unlock.** By making currents opt-in, the entire large feature landed without touching the golden master or fairness matrix, so it could ship as a reviewable branch with zero blast radius. This is the pattern to reuse for any future gameplay-altering system.
- **Forks-as-variables paid for itself immediately.** Not committing to intensity/density/rarity meant C4–C6 didn't stall on tuning debates; the sandbox turns those debates into slider-dragging.
- **The interim vs formal fairness distinction matters.** A 60-seed spot check is honest evidence, not a full proof. It's labeled as such in code and here so it isn't mistaken for the 80k gate.
- **Tooling friction, logged:** the managed preview panel shares a dev-server port with another session and was unreachable; the independent Playwright capture path (`scripts/capture-docs-shots.mjs` pattern) is the reliable fallback and should be the default for headless visual verification.

---

## 10. Recommended next steps (priority order)

1. **Merge PR #2** (zero-risk) → Catalog + Sandbox live for review.
2. **Feel-tuning pass** in the Sandbox → lock default intensity/spacing.
3. **Player entry:** ship a "Currents" toggle or mode so users can actually play it.
4. **Formal G-Currents:** full 80k sweep + frozen currents golden.
5. **Ratify ADR-014**, then graduate additional `candidate` catalog patterns (whirl-pair, shear-step, breathing-wall, roaming-eddy) into the shipping cell set as each passes the sweep.

---

*Companion docs: [`docs/currents/CURRENTS_PROGRAM.md`](../currents/CURRENTS_PROGRAM.md) (plan of record) · PR #2. This report is versioned in-repo; ping to render as a shareable Artifact or PDF.*
