# Tuning the physics

All tunables are JSON — no magic numbers in code. Hot-reload applies them instantly in dev.

## The config map

| File | Owns |
|---|---|
| `src/config/physics.json` | Classic's forces: gravity, buoyancy, drag, stroke impulse/blend, terminal clamps |
| `src/config/difficulty.json` | Classic's level generation: speeds, gap curve, spacing, fairness clamps, world size |
| `src/config/modes/dive.json` | Dive's physics + bidirectional thrust (T_up/T_down, attack/decay) + its own spawn table |
| `src/config/modes/powerdive.json` | Power Dive: adds `thrustForward` and `springK` (home-spring stiffness) |
| `src/config/modes/currents-lab.json` | Lab presets — zones and vortices as data |
| `src/config/characters/*.json` | Per-creature scale factors + cards |

## The workflow

1. **Feel it live** — `/?scene=sandbox` has every Classic constant on a slider with live terminal-velocity telemetry; the Lab does the same job for currents.
2. **Edit the JSON** — with a one-line rationale in the commit message (house rule).
3. **Re-verify** — `npm test`. The fairness matrix and feel-target sims will tell you if you broke playability; the golden master will tell you if you touched the locked baseline.

## The locked zone

Classic(Seal) is **tuning-locked**: `physics.json`, `difficulty.json` and `seal.json` values it consumes can't change without an architecture decision record, a fresh 10,000-run sweep, and a regenerated golden master. Everything else — Dive, Power Dive, Lab presets, other creatures — is fair game with a normal test pass.

## Useful invariants when tuning

* Terminal sink = `√((gravity − buoyancy·scale) / (drag·scale))` — keep 80–120 px/s for "swimmy".
* Tap arc height ≈ 50 px at baseline; it's the player's vertical control quantum. If you change it, gap sizes must follow (they do, via `gapScaleFor` — but re-sweep).
* Current presets are auto-checked against the weakest creature's thrust budget; a preset that fails the invariant test is unfair by definition, not "spicy".
