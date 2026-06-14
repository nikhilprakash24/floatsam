import physicsJson from '../../config/physics.json';
import difficultyJson from '../../config/difficulty.json';
import { ConstantBuoyancyField } from '../fluid/FluidField';
import type { FluidPhysicsConfig } from '../fluid/FluidBody';
import { TapUpPolicy } from '../input/TapUpPolicy';
import type { DifficultyConfig } from '../spawn/Spawner';
import type { GameMode } from './GameMode';

/**
 * Classic — the shipped, tuning-locked mode. Its numbers ARE the shipped
 * physics.json + difficulty.json; gravity stays in the integrator and buoyancy
 * in a ConstantBuoyancyField exactly as ADR-003 left it. Changing any value
 * Classic(Seal) consumes requires an ADR + a fresh 10k sweep (v3.3 §10.4).
 */
export const CLASSIC_MODE: GameMode = {
  id: 'classic',
  name: 'Classic',
  biaxial: false,
  physics: physicsJson as FluidPhysicsConfig,
  spawn: difficultyJson as DifficultyConfig,
  makeField: (eff) => new ConstantBuoyancyField(eff.buoyancyAccel),
  makeInputPolicy: (eff) => new TapUpPolicy(eff),
};
