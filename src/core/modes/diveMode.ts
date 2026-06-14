import diveJson from '../../config/modes/dive.json';
import { ConstantBuoyancyField } from '../fluid/FluidField';
import type { FluidPhysicsConfig } from '../fluid/FluidBody';
import { BiAxialPolicy } from '../input/BiAxialPolicy';
import type { EffectivePhysics } from '../character/CharacterProfile';
import type { DifficultyConfig } from '../spawn/Spawner';
import type { GameMode } from './GameMode';

const cfg = diveJson as {
  physics: FluidPhysicsConfig;
  biaxial: { thrustUp: number; thrustDown: number; attackMs: number; decayMs: number };
  spawn: DifficultyConfig;
};

/**
 * Dive — bidirectional public mode (v3.3 §1). Near-neutral buoyancy plus a
 * BiAxialPolicy: the player actively swims up AND dives down, which is the
 * mode's reason to exist (§3.5 — it gives players the descent the medium
 * denies them). T_up/T_down are scaled by the character's flap power.
 */
export const DIVE_MODE: GameMode = {
  id: 'dive',
  name: 'Dive',
  biaxial: true,
  physics: cfg.physics,
  spawn: cfg.spawn,
  makeField: (eff) => new ConstantBuoyancyField(eff.buoyancyAccel),
  makeInputPolicy: (eff) => {
    const scale = (eff as EffectivePhysics).thrustScale;
    return new BiAxialPolicy({
      thrustUp: cfg.biaxial.thrustUp * scale,
      thrustDown: cfg.biaxial.thrustDown * scale,
      attackMs: cfg.biaxial.attackMs,
      decayMs: cfg.biaxial.decayMs,
    });
  },
};
