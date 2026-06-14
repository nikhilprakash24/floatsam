import physicsJson from '../src/config/physics.json';
import difficultyJson from '../src/config/difficulty.json';
import { Simulation, type PhysicsConfigFull, type SimEvents } from '../src/core/sim/Simulation';
import { CLASSIC_MODE } from '../src/core/modes/classicMode';
import { SEAL } from '../src/core/character/CharacterProfile';
import type { DifficultyConfig } from '../src/core/spawn/Spawner';

export const PHYSICS: PhysicsConfigFull = physicsJson;
export const DIFFICULTY: DifficultyConfig = difficultyJson;

/**
 * Canonical Classic(Seal) construction. The golden-master regression and the
 * fairness/feel sims route through here, so the two P6 bit-identical refactor
 * gates only need to update THIS factory — the frozen fixture stays the
 * invariant. After step 2 this becomes `new Simulation(CLASSIC_MODE, SEAL,
 * seed, events)`; today the Seal is the implicit identity character.
 */
export function makeClassicSealSim(
  seed: number,
  events?: SimEvents,
  spawnPatch?: Partial<DifficultyConfig>,
): Simulation {
  const mode = spawnPatch
    ? { ...CLASSIC_MODE, spawn: { ...CLASSIC_MODE.spawn, ...spawnPatch } }
    : CLASSIC_MODE;
  return new Simulation(mode, SEAL, seed, events);
}
