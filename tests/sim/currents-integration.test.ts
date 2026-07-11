import { describe, expect, it } from 'vitest';
import { Simulation } from '../../src/core/sim/Simulation';
import { POWER_DIVE_MODE } from '../../src/core/modes/powerDiveMode';
import { CHARACTERS, characterById } from '../../src/core/character/CharacterProfile';
import { diveHold } from './fairness-harness';

const SEAL = characterById('seal');

/**
 * Currents integration (currents program C4). Currents are opt-in and
 * default-off, so the whole existing game — Classic golden included — is
 * untouched. These prove: (1) off is bit-identical, (2) on actually perturbs
 * the run, (3) on stays escapable for every creature (a G-Currents spot check;
 * the full 80k sweep is a follow-up gate).
 */
describe('currents opt-in seam', () => {
  it('currents-off is bit-identical whether the flag is omitted or explicitly false', () => {
    const a = new Simulation(POWER_DIVE_MODE, SEAL, 77); // config default → off
    const b = new Simulation(POWER_DIVE_MODE, SEAL, 77, {}, 1, false); // explicit off
    for (let i = 0; i < 700; i++) {
      const ha = diveHold(a);
      a.setHold(ha.up, ha.down);
      const hb = diveHold(b);
      b.setHold(hb.up, hb.down);
      a.tick();
      b.tick();
      expect(b.body.x).toBe(a.body.x);
      expect(b.body.y).toBe(a.body.y);
      expect(b.body.vy).toBe(a.body.vy);
    }
    expect(a.hasCurrents).toBe(false);
    expect(b.hasCurrents).toBe(false);
  });

  it('currents-on perturbs the trajectory and exposes live cells', () => {
    const off = new Simulation(POWER_DIVE_MODE, SEAL, 77, {}, 1, false);
    const on = new Simulation(POWER_DIVE_MODE, SEAL, 77, {}, 1, true);
    let diverged = false;
    for (let i = 0; i < 700 && !diverged; i++) {
      for (const s of [off, on]) {
        const h = diveHold(s);
        s.setHold(h.up, h.down);
        s.tick();
      }
      if (Math.abs(off.body.y - on.body.y) > 1 || Math.abs(off.body.x - on.body.x) > 1) diverged = true;
    }
    expect(diverged).toBe(true);
    expect(on.hasCurrents).toBe(true);
    expect(on.currentCells().length).toBeGreaterThan(0);
  });

  it('currents-on Power Dive stays escapable for all creatures (G-Currents spot check)', () => {
    const seeds = 60;
    const target = 8;
    const maxFrames = 7200;
    for (const ch of CHARACTERS) {
      let fails = 0;
      for (let seed = 1; seed <= seeds; seed++) {
        const sim = new Simulation(POWER_DIVE_MODE, ch, seed, {}, 1, true);
        let frames = 0;
        while (sim.phase === 'PLAY' && sim.score < target && frames < maxFrames) {
          const h = diveHold(sim);
          sim.setHold(h.up, h.down);
          sim.tick();
          frames++;
        }
        if (sim.score < target) fails++;
      }
      // Weakest simple bot clears 8 gates through currents ≥85% of runs ⇒ a human
      // with lookahead can too. (Observed at intensity 1.0: ≤1/60 failures.)
      expect(fails / seeds).toBeLessThanOrEqual(0.15);
    }
  });
});
