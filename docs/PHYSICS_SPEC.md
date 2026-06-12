# Fluid Physics Spec — Classic Mode

All constants live in `src/config/physics.json` (single source of truth). Mass is normalized to 1, so every "force" below is an acceleration in px/s². Y axis is screen-down positive (sinking = +vy).

## Forces per fixed step (1/60 s)

```
a_gravity  = +gravity                       // 600 px/s² down — tuned low for water feel
a_buoyancy = field.sampleForce(x, y, t).y   // Classic: constant -buoyancyAccel (480 up)
a_drag     = -dragCoefficient · v · |v|     // quadratic, per-axis — THE underwater feel
a_swim     = tap impulse drained over swimBlendSteps fixed steps (not an instant velocity set)
v_y clamped to [-maxRiseSpeed, +maxSinkSpeed] after integration (asymmetric terminals)
```

Integration: semi-implicit Euler at fixed 1/60 s. Renderer interpolates between the previous and current sim states.

## Derived numbers (current tuning)

| Quantity | Formula | Value |
|---|---|---|
| Net sink acceleration | gravity − buoyancyAccel | 200 px/s² |
| Terminal sink velocity | √(net / dragCoefficient) | √(200/0.014) ≈ **119.5 px/s** |
| Tap Δv | swimImpulse, blended over 3 steps | 330 px/s up |
| Tap arc height (sim-measured) | — | ≈ 50 px |

## Feel targets (§4.2 acceptance, enforced by tests/sim/feel.test.ts)

- Idle terminal sink velocity: **80–120 px/s** (sim-measured, ±5%).
- Single tap from terminal sink arrests the fall and produces a rise arc of **40–120 px** peaking within **0.3–1.0 s**; momentum carries (velocity never snaps).
- Per-step velocity change bounded (no instantaneous motion): |Δv| per fixed step < 160 px/s.
- Determinism: identical seed + identical input frames ⇒ bit-identical trajectories.

## Tuning ranges

| Constant | Default | Sane range | Effect |
|---|---|---|---|
| gravity | 600 | 400–900 | overall weight |
| buoyancyAccel | 400 | 300–800 | net sink/float bias |
| dragCoefficient | 0.014 | 0.004–0.02 | water thickness; sets terminals |
| swimImpulse | 330 | 250–550 | tap strength |
| swimBlendSteps | 3 | 2–4 | tap softness |
| maxRiseSpeed | 420 | 300–600 | chained-tap ceiling |
| maxSinkSpeed | 240 | 150–350 | dive ceiling |

**Fairness coupling:** the tap-arc height (~50 px) is the player's vertical control quantum. `difficulty.json`'s `maxRisePerSecond`/`maxSinkPerSecond` clamps were derived empirically against the reference bot (tests/sim/fairness.test.ts): descents are the binding constraint because quadratic drag makes sinking slow and every in-gap brake-tap injects ~50 px of altitude. If you retune swimImpulse or drag, re-run the 10k fairness sweep before merging.

## Future-proofing seam (do NOT build now)

`FluidField.sampleForce(x, y, t)` — Classic returns a constant. Normal mode later swaps in a vector-field implementation (currents/vortices) without touching FluidBody or Player. Any PR adding a vector field before post-launch is rejected per §8.
