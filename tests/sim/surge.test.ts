import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng';
import { SurgeScheduler, SurgeField, type SurgeConfig } from '../../src/core/fluid/currents/Surge';
import { Simulation } from '../../src/core/sim/Simulation';
import { POWER_DIVE_MODE } from '../../src/core/modes/powerDiveMode';
import { characterById } from '../../src/core/character/CharacterProfile';
import { diveHold } from './fairness-harness';

const SEAL = characterById('seal');
const fast: SurgeConfig = { everySecMin: 0.5, everySecMax: 0.5, holdSec: 0.4, rampSec: 0.2, intensity: 1, lethal: false };

describe('SurgeScheduler', () => {
  it('same seed ⇒ identical ramp timeline', () => {
    const a = new SurgeScheduler(fast, createRng(11));
    const b = new SurgeScheduler(fast, createRng(11));
    for (let i = 0; i < 500; i++) expect(a.update(1 / 60)).toBeCloseTo(b.update(1 / 60), 12);
  });

  it('envelope stays in [0,1], reaches full storm, and returns to calm', () => {
    const s = new SurgeScheduler(fast, createRng(3));
    let max = 0;
    let sawActive = false;
    let sawIdleAfterActive = false;
    for (let i = 0; i < 300; i++) {
      const r = s.update(1 / 60);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1);
      max = Math.max(max, r);
      if (s.active) sawActive = true;
      if (sawActive && !s.active) sawIdleAfterActive = true;
    }
    expect(max).toBeCloseTo(1, 6); // hits the hold plateau
    expect(sawIdleAfterActive).toBe(true); // rare, not permanent
  });

  it('is calm most of the time (rare event)', () => {
    // Realistic spacing: over ~20 s the storm is active only a small fraction.
    const real: SurgeConfig = { everySecMin: 8, everySecMax: 8, holdSec: 4, rampSec: 0.7, intensity: 1, lethal: false };
    const s = new SurgeScheduler(real, createRng(1));
    let activeFrames = 0;
    const frames = 20 * 60;
    for (let i = 0; i < frames; i++) if (s.update(1 / 60) > 0) activeFrames++;
    expect(activeFrames / frames).toBeLessThan(0.4);
  });
});

describe('SurgeField', () => {
  it('is zero while calm and non-zero at full storm', () => {
    const s = new SurgeScheduler(fast, createRng(2));
    const field = new SurgeField(s, 1);
    expect(field.sampleForce(240, 360, 0)).toEqual({ x: 0, y: 0 }); // ramp 0 at start
    // Drive to the hold plateau.
    for (let i = 0; i < 60 && s.ramp < 0.99; i++) s.update(1 / 60);
    const f = field.sampleForce(240, 360, 1.2);
    expect(Math.hypot(f.x, f.y)).toBeGreaterThan(0);
  });

  it('scales with the ramp (half ramp ⇒ ~half force)', () => {
    const s = new SurgeScheduler(fast, createRng(9));
    for (let i = 0; i < 60 && s.ramp < 0.99; i++) s.update(1 / 60);
    const full = new SurgeField(s, 1).sampleForce(200, 300, 0.5);
    const half = new SurgeField(s, 0.5).sampleForce(200, 300, 0.5);
    expect(half.x).toBeCloseTo(full.x * 0.5, 6);
    expect(half.y).toBeCloseTo(full.y * 0.5, 6);
  });
});

describe('surge in the Simulation', () => {
  it('surge-on runs are deterministic (same seed ⇒ identical trajectory)', () => {
    const a = new Simulation(POWER_DIVE_MODE, SEAL, 99, {}, 1, true, true);
    const b = new Simulation(POWER_DIVE_MODE, SEAL, 99, {}, 1, true, true);
    for (let i = 0; i < 800; i++) {
      const h = diveHold(a);
      a.setHold(h.up, h.down);
      const h2 = diveHold(b);
      b.setHold(h2.up, h2.down);
      a.tick();
      b.tick();
      expect(b.body.y).toBe(a.body.y);
      expect(b.body.x).toBe(a.body.x);
    }
    expect(a.surgeRamp).toBe(b.surgeRamp);
  });

  it('surge requires currents (surge:true, currents:false ⇒ no surge)', () => {
    const sim = new Simulation(POWER_DIVE_MODE, SEAL, 5, {}, 1, false, true);
    expect(sim.hasCurrents).toBe(false);
    expect(sim.surgeRamp).toBe(0);
  });
});
