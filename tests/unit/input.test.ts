import { describe, expect, it } from 'vitest';
import { TapUpPolicy } from '../../src/core/input/TapUpPolicy';
import { PHYSICS } from '../helpers';

const STEP = PHYSICS.fixedStep;

describe('TapUpPolicy', () => {
  it('a press fills the reservoir to swimImpulse, drained over swimBlendSteps', () => {
    const p = new TapUpPolicy(PHYSICS);
    p.press();
    const slice = PHYSICS.swimImpulse / PHYSICS.swimBlendSteps;
    for (let i = 0; i < PHYSICS.swimBlendSteps; i++) {
      const thrust = p.step(STEP);
      expect(thrust.dvy).toBeCloseTo(-slice, 9);
      expect(thrust.dvx).toBe(0);
    }
    expect(p.reservoir()).toBeCloseTo(0, 9);
    // Drained — subsequent steps contribute nothing.
    expect(p.step(STEP).dvy).toBe(-0);
  });

  it('tops up rather than stacking on tap spam', () => {
    const p = new TapUpPolicy(PHYSICS);
    p.press();
    p.press();
    p.press();
    // After topping up, the reservoir is exactly one impulse minus one slice.
    p.step(STEP);
    const slice = PHYSICS.swimImpulse / PHYSICS.swimBlendSteps;
    expect(p.reservoir()).toBeCloseTo(PHYSICS.swimImpulse - slice, 9);
  });

  it('produces no thrust without a press', () => {
    const p = new TapUpPolicy(PHYSICS);
    expect(p.step(STEP)).toEqual({ dvx: 0, dvy: -0 });
    expect(p.reservoir()).toBe(0);
  });

  it('ignores held input (tap-based policy)', () => {
    const p = new TapUpPolicy(PHYSICS);
    p.setHold(true, true);
    expect(p.step(STEP).dvy).toBe(-0);
  });

  it('reset empties the reservoir', () => {
    const p = new TapUpPolicy(PHYSICS);
    p.press();
    p.reset();
    expect(p.reservoir()).toBe(0);
    expect(p.step(STEP).dvy).toBe(-0);
  });
});
