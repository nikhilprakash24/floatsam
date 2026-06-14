import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeClassicSealSim } from '../helpers';
import { DIFFICULTY } from '../helpers';
import type { Simulation } from '../../src/core/sim/Simulation';

/**
 * GOLDEN MASTER — the bit-identical anchor for the v3.3 GameMode +
 * CharacterProfile refactors (P6 risk #1). The fixture captures the shipped
 * Classic(Seal) trajectory frame-by-frame; both refactors must reproduce it
 * EXACTLY (mass/drag/thrust/buoyancy scales of 1.0 ⇒ X*1.0===X in IEEE754).
 *
 * Regenerate ONLY on an intentional, ADR-backed Classic change:
 *   GOLDEN_REGEN=1 npx vitest run tests/sim/golden-classic-seal.test.ts
 */
const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(here, '..', 'fixtures', 'classic-seal-golden.json');
const SEED = 0xc1a5;
const FRAMES = 1500;

/** Deterministic gate-aware pilot — exercises spawn/score/collision paths. */
function botShouldTap(sim: Simulation): boolean {
  const r = sim.hitboxRadius;
  const w = DIFFICULTY.pipeWidth;
  const ahead = [...sim.gates()]
    .filter((g) => g.x + w / 2 + r > sim.body.x)
    .sort((a, b) => a.x - b.x);
  const current = ahead[0];
  if (!current) return sim.body.y > DIFFICULTY.worldHeight * 0.45;
  const next = ahead[1];
  let brake = current.gapCenterY + current.gapSize * 0.15;
  if (next && next.gapCenterY > current.gapCenterY) {
    const safeBottom = current.gapCenterY + current.gapSize / 2 - r - 18;
    brake = Math.min(safeBottom, Math.max(brake, next.gapCenterY + next.gapSize * 0.15));
  }
  return sim.body.y + sim.body.vy * 0.2 > brake;
}

interface Frame {
  f: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  pend: number;
  score: number;
  phase: string;
  gsum: number;
}

function capture(): Frame[] {
  const sim = makeClassicSealSim(SEED);
  const out: Frame[] = [];
  for (let f = 0; f < FRAMES; f++) {
    // Pilot competently, then release for the final stretch so the body
    // deterministically sinks and dies — the golden covers PLAY scoring AND
    // the DEAD drift path in one frozen run.
    if (f < FRAMES - 360 && botShouldTap(sim)) sim.tap();
    sim.tick();
    // Checksum of live gate geometry catches any spawner/RNG drift.
    let gsum = 0;
    for (const g of sim.gates()) gsum += g.x * 31 + g.gapCenterY * 7 + g.gapSize;
    out.push({
      f,
      x: sim.body.x,
      y: sim.body.y,
      vx: sim.body.vx,
      vy: sim.body.vy,
      pend: sim.pendingImpulse,
      score: sim.score,
      phase: sim.phase,
      gsum,
    });
  }
  return out;
}

describe('golden master: Classic(Seal) is bit-identical across refactors', () => {
  it('reproduces the frozen shipped trajectory exactly', () => {
    const trajectory = capture();

    if (process.env['GOLDEN_REGEN'] === '1' || !existsSync(FIXTURE)) {
      mkdirSync(dirname(FIXTURE), { recursive: true });
      writeFileSync(FIXTURE, JSON.stringify(trajectory));
      // On generation we still assert self-consistency.
    }

    const golden = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Frame[];
    expect(trajectory.length).toBe(golden.length);
    expect(trajectory).toEqual(golden);
  });

  it('the frozen run actually exercises scoring and death (guards a trivial fixture)', () => {
    const golden = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Frame[];
    expect(golden.at(-1)!.score).toBeGreaterThan(0);
    expect(golden.some((fr) => fr.phase !== 'PLAY')).toBe(true);
  });
});
