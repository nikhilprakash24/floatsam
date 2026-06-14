import type { Gate } from '../spawn/Spawner';

/** Legacy single-key best (pre-roster); kept for one-time migration. */
export const BEST_SCORE_KEY = 'uf.bestScore';

/** Best score is kept per (mode, character) pair (v3.3 §4.3). */
export function bestKeyFor(modeId: string, characterId: string): string {
  return `uf.best.${modeId}.${characterId}`;
}

/**
 * Marks gates whose trailing edge has passed the player and returns how many
 * new points that is. Pure bookkeeping — persistence lives behind KVStore.
 */
export function collectPassedGates(gates: Gate[], playerX: number, pipeWidth: number): number {
  let points = 0;
  for (const g of gates) {
    if (!g.scored && g.x + pipeWidth / 2 < playerX) {
      g.scored = true;
      points++;
    }
  }
  return points;
}
