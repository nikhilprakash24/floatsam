# Fairness by construction

"Fair" here has a precise meaning: **every layout the generator can produce is passable by a simple reference bot** — a deliberately dumb controller with no lookahead tricks. If *it* can clear 15 gates, a human with eyes can.

## The problem

With 4 creatures × 3 modes, hand-tuning each combination's level generation would be 12 tuning jobs that break every time a creature changes. The first naive attempt proved the danger: giving the big-flap creatures (Puffer, Sea Lion) the Seal's level geometry produced a **0% pass rate** — their powerful strokes overshot every gap.

## The solution: derive, don't tune

The generator reads the *pair's own physics* before laying anything out:

* **`clampsFor(creature, mode)`** — how far the next gap's center may jump up or down, computed from that pair's real climb rate and terminal sink, with a 0.75 safety factor. Faster tempo ⇒ less time between gates ⇒ automatically smaller jumps.
* **`gapScaleFor(creature, mode)`** — gap size scaled by hitbox ratio, and in tap-mode by an overshoot factor for strong flaps. Enlarge-only: no creature ever gets a tighter course than the baseline Seal.

The Seal's derived values are exactly 1.0×, so the original locked game is untouched by construction.

## The verification pyramid

| Layer | What | Scale |
|---|---|---|
| Golden master | Original Classic(Seal) trajectory, bit-exact | every test run |
| Fairness matrix | Reference bots clear 15 gates, all mode×creature pairs | 1,500 seeds/pair in CI; **10,000/pair (80,000 runs, 0 failures)** as the gate evidence |
| Field invariants | Current presets bounded vs the *weakest* creature's thrust (up ≤ 0.8×T_up, down ≤ 0.5×T_down) | dense spatial grid, every run |
| E2E | Real browser: menus, inputs, persistence, pause, all three modes | 11 tests |

Power Dive is the honest exception: its dive-lunges-forward coupling can trap a naive bot, so it's held to a documented **≥99% "advanced" bar** (measured 99.5–100%) instead of strict zero — a controller limitation, not an unfair layout.

## The rule that keeps it true

Any change to a value the locked baseline consumes requires an architecture decision record **plus** a fresh 10,000-run sweep **plus** a green golden master. Fairness isn't a launch checkbox — it's a standing invariant.
