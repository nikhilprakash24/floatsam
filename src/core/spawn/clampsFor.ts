import { terminalSpeed } from '../fluid/FluidBody';
import { SEAL, deriveEffective, type CharacterProfile } from '../character/CharacterProfile';
import type { GameMode } from '../modes/GameMode';
import type { SpawnClamps } from './Spawner';

export type { SpawnClamps };

/**
 * Per-(character × mode) gap-size multiplier (ARCHITECTURE v3.3 §3.2: spawn
 * geometry is derived from the pair, not assumed). A bigger body needs a bigger
 * gap (hitbox ratio); in Classic a stronger flap overshoots, so it needs extra
 * vertical room (arc factor). Only ever ENLARGES — never tightens below the
 * Seal baseline, so fairness can't regress. Seal = 1.0 exactly (bit-identical).
 */
export function gapScaleFor(character: CharacterProfile, mode: GameMode): number {
  const sizeRatio = character.hitboxRadius / SEAL.hitboxRadius;
  const arcFactor = mode.biaxial ? 1 : 1 + 0.6 * Math.max(0, character.thrustScale - 1);
  return Math.max(1, sizeRatio * arcFactor);
}

/**
 * Derive a pair's vertical reachability clamps from (character × mode), so
 * fairness is correct by construction and "same seed ⇒ different layouts per
 * character" (ARCHITECTURE v3.3 §3.5). The 0.75 safety factor stays in the
 * spawner; this returns the per-second reachability ceilings it scales.
 *
 * Seal × Classic invariant: thrustScale 1.0 and an identical
 * passive-terminal-sink ratio of exactly 1.0 reproduce the shipped {100, 45}
 * bit-for-bit — so routing every pair (including the Seal) through this never
 * disturbs locked Classic(Seal). Verified by the golden master + 10k sweep.
 */
export function clampsFor(character: CharacterProfile, mode: GameMode): SpawnClamps {
  const base = mode.spawn;

  if (mode.biaxial) {
    // Active thrust both directions → both scale with flap power.
    return {
      maxRisePerSecond: base.maxRisePerSecond * character.thrustScale,
      maxSinkPerSecond: base.maxSinkPerSecond * character.thrustScale,
    };
  }

  // Tap-based mode: rising scales with flap power; sinking is passive, so it
  // scales with the character's effective terminal-sink relative to the Seal.
  const eff = deriveEffective(mode.physics, character);
  const baseTerm = terminalSpeed(
    mode.physics.gravity - mode.physics.buoyancyAccel,
    mode.physics.dragCoefficient,
  );
  const effTerm = terminalSpeed(
    (mode.physics.gravity - eff.buoyancyAccel) / character.massScale,
    eff.dragCoefficient,
  );
  return {
    maxRisePerSecond: base.maxRisePerSecond * character.thrustScale,
    maxSinkPerSecond: base.maxSinkPerSecond * (effTerm / baseTerm),
  };
}
