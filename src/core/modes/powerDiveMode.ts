import powerJson from '../../config/modes/powerdive.json';
import { ConstantBuoyancyField } from '../fluid/FluidField';
import { CompositeField } from '../fluid/fields/CompositeField';
import { HomeSpringField } from '../fluid/fields/HomeSpringField';
import type { FluidPhysicsConfig } from '../fluid/FluidBody';
import { PowerDivePolicy } from '../input/PowerDivePolicy';
import type { EffectivePhysics } from '../character/CharacterProfile';
import type { DifficultyConfig } from '../spawn/Spawner';
import type { GameMode } from './GameMode';

const cfg = powerJson as {
  physics: FluidPhysicsConfig;
  biaxial: { thrustUp: number; thrustDown: number; attackMs: number; decayMs: number };
  thrustForward: number;
  springK: number;
  spawn: DifficultyConfig;
};

/**
 * Power Dive — bidirectional like Dive, but a dive lunges DOWN and FORWARD and
 * the player can roam horizontally, pulled back to a home column by a spring.
 * The forward lunge is character-scaled (a heavier, more powerful creature
 * surges further), adding a layer of positioning complexity — and the free-x
 * body is the seam through which lateral currents will matter later (§9).
 */
export const POWER_DIVE_MODE: GameMode = {
  id: 'powerdive',
  name: 'Power Dive',
  biaxial: true,
  freeX: true,
  physics: cfg.physics,
  spawn: cfg.spawn,
  makeField: (eff) =>
    new CompositeField([
      new ConstantBuoyancyField(eff.buoyancyAccel),
      // Scale stiffness by mass so the integrator's a = F/mass gives a
      // mass-independent restoring acceleration — heavy creatures snap home
      // just as crisply, instead of wallowing forward into pipes.
      new HomeSpringField({ homeX: cfg.spawn.playerX, k: cfg.springK * (eff as EffectivePhysics).massScale }),
    ]),
  makeInputPolicy: (eff) => {
    const scale = (eff as EffectivePhysics).thrustScale;
    return new PowerDivePolicy({
      thrustUp: cfg.biaxial.thrustUp * scale,
      thrustDown: cfg.biaxial.thrustDown * scale,
      thrustForward: cfg.thrustForward * scale,
      attackMs: cfg.biaxial.attackMs,
      decayMs: cfg.biaxial.decayMs,
    });
  },
};
