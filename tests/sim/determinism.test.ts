import { describe, expect, it } from 'vitest';
import type { Simulation } from '../../src/core/sim/Simulation';
import { makeClassicSealSim } from '../helpers';

function run(seed: number, tapFrames: Set<number>, frames: number): Simulation {
  const sim = makeClassicSealSim(seed);
  for (let f = 0; f < frames; f++) {
    if (tapFrames.has(f)) sim.tap();
    sim.tick();
  }
  return sim;
}

describe('determinism (§3 rule 3)', () => {
  it('identical seed + identical tap frames ⇒ bit-identical trajectory and score', () => {
    const taps = new Set([10, 45, 80, 81, 120, 200, 260, 300, 340, 400, 470, 530]);
    const a = run(777, taps, 600);
    const b = run(777, taps, 600);
    expect(a.body).toEqual(b.body);
    expect(a.score).toBe(b.score);
    expect(a.phase).toBe(b.phase);
    expect(a.gates().map((g) => ({ x: g.x, c: g.gapCenterY }))).toEqual(
      b.gates().map((g) => ({ x: g.x, c: g.gapCenterY })),
    );
  });

  it('different seeds produce different obstacle streams', () => {
    const a = run(1, new Set(), 60);
    const b = run(2, new Set(), 60);
    expect(a.gates().map((g) => g.gapCenterY)).not.toEqual(b.gates().map((g) => g.gapCenterY));
  });
});
