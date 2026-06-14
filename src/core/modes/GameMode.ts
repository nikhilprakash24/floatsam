import type { FluidField } from '../fluid/FluidField';
import type { FluidPhysicsConfig } from '../fluid/FluidBody';
import type { InputPolicy } from '../input/InputPolicy';
import type { DifficultyConfig } from '../spawn/Spawner';

/**
 * A mode = data + two strategy factories (ARCHITECTURE v3.3 §3.1 rule 5).
 * Adding a mode must not touch FluidBody, the Game loop, or locked Classic
 * files. The factories receive the EFFECTIVE (character-scaled) config so the
 * field's buoyancy and the policy's impulse already reflect the chosen
 * character; for the Seal all scales are 1.0 so they receive the base values.
 */
export interface GameMode {
  readonly id: string;
  /** Base continuous-force tuning for this mode (pre-character-scaling). */
  readonly physics: FluidPhysicsConfig;
  /** Spawn / difficulty profile (pre-character clamp derivation). */
  readonly spawn: DifficultyConfig;
  makeField(effective: FluidPhysicsConfig): FluidField;
  makeInputPolicy(effective: FluidPhysicsConfig): InputPolicy;
}
