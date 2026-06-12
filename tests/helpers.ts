import physicsJson from '../src/config/physics.json';
import difficultyJson from '../src/config/difficulty.json';
import type { PhysicsConfigFull } from '../src/core/sim/Simulation';
import type { DifficultyConfig } from '../src/core/spawn/Spawner';

export const PHYSICS: PhysicsConfigFull = physicsJson;
export const DIFFICULTY: DifficultyConfig = difficultyJson;
