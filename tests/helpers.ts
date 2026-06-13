import physicsJson from '../src/config/physics.json';
import difficultyJson from '../src/config/difficulty.json';
import { Simulation, type PhysicsConfigFull, type SimEvents } from '../src/core/sim/Simulation';
import type { DifficultyConfig } from '../src/core/spawn/Spawner';

export const PHYSICS: PhysicsConfigFull = physicsJson;
export const DIFFICULTY: DifficultyConfig = difficultyJson;

/**
 * Canonical Classic(Seal) construction. The golden-master regression and the
 * fairness/feel sims route through here, so the two P6 bit-identical refactor
 * gates only need to update THIS factory — the frozen fixture stays the
 * invariant. Today it is the shipped monolithic Simulation; after the
 * GameMode/CharacterProfile refactors it becomes
 * `new Simulation(CLASSIC_MODE, SEAL, seed, events)` with no behavior change.
 */
export function makeClassicSealSim(seed: number, events?: SimEvents): Simulation {
  return new Simulation(PHYSICS, DIFFICULTY, seed, events);
}
