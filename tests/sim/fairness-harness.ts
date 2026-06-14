import { Simulation } from '../../src/core/sim/Simulation';
import type { GameMode } from '../../src/core/modes/GameMode';
import type { CharacterProfile } from '../../src/core/character/CharacterProfile';

/**
 * Reference bots for the fairness matrix. If a deliberately simple controller
 * clears N gates, a human with full lookahead can too (ARCHITECTURE v3.3 §4.3).
 */

/** Nearest gate whose trailing edge is still ahead of the player. */
function nextGate(sim: Simulation) {
  const r = sim.hitboxRadius;
  const w = sim.difficulty.pipeWidth;
  return [...sim.gates()]
    .filter((g) => g.x + w / 2 + r > sim.body.x)
    .sort((a, b) => a.x - b.x)[0];
}

/** Classic tap controller: hold altitude above a brake line in the next gap. */
export function classicShouldTap(sim: Simulation): boolean {
  const r = sim.hitboxRadius;
  const cur = nextGate(sim);
  if (!cur) return sim.body.y > sim.difficulty.worldHeight * 0.45;
  const ahead = [...sim.gates()]
    .filter((g) => g.x + sim.difficulty.pipeWidth / 2 + r > sim.body.x)
    .sort((a, b) => a.x - b.x);
  const next = ahead[1];
  let brake = cur.gapCenterY + cur.gapSize * 0.15;
  if (next && next.gapCenterY > cur.gapCenterY) {
    const safeBottom = cur.gapCenterY + cur.gapSize / 2 - r - 18;
    brake = Math.min(safeBottom, Math.max(brake, next.gapCenterY + next.gapSize * 0.15));
  }
  return sim.body.y + sim.body.vy * 0.2 > brake;
}

/**
 * Dive bang-bang controller: track the next gap centre with up/down thrust.
 * In free-x modes (Power Dive) a dive also lunges forward, so it aligns earlier
 * (longer lookahead) and eases off diving once horizontally on top of the gate
 * to avoid lunging into a misaligned pipe.
 */
export function diveHold(sim: Simulation): { up: boolean; down: boolean } {
  const cur = nextGate(sim);
  const target = cur ? cur.gapCenterY : sim.difficulty.worldHeight * 0.5;
  const lookahead = sim.mode.freeX ? 0.32 : 0.22;
  const predicted = sim.body.y + sim.body.vy * lookahead;
  const dead = cur ? Math.max(10, cur.gapSize * 0.12) : 20;

  if (predicted > target + dead) {
    // About to lunge into the gate's x-zone? Only dive if we'd land in the gap.
    if (sim.mode.freeX && cur) {
      const near = cur.x - sim.body.x < sim.difficulty.pipeWidth + sim.hitboxRadius + 24;
      const wouldClearTop = predicted < cur.gapCenterY + cur.gapSize / 2 - sim.hitboxRadius;
      if (near && !wouldClearTop) return { up: false, down: false };
    }
    return { up: true, down: false };
  }
  if (predicted < target - dead) return { up: false, down: true };
  return { up: false, down: false };
}

export interface PairResult {
  mode: string;
  character: string;
  failures: number;
  minScore: number;
  total: number;
}

/** Run `seeds` runs of (mode × character); a run succeeds at `gates` cleared. */
export function runPair(
  mode: GameMode,
  character: CharacterProfile,
  seeds: number,
  gates: number,
  pace = 1,
  maxFrames = 7200,
): PairResult {
  let failures = 0;
  let minScore = Infinity;
  for (let seed = 1; seed <= seeds; seed++) {
    const sim = new Simulation(mode, character, seed, {}, pace);
    let frames = 0;
    while (sim.phase === 'PLAY' && sim.score < gates && frames < maxFrames) {
      if (mode.biaxial) {
        const h = diveHold(sim);
        sim.setHold(h.up, h.down);
      } else if (classicShouldTap(sim)) {
        sim.tap();
      }
      sim.tick();
      frames++;
    }
    minScore = Math.min(minScore, sim.score);
    if (sim.score < gates) failures++;
  }
  return { mode: mode.id, character: character.id, failures, minScore, total: seeds };
}
