import { describe, expect, it } from 'vitest';
import { PowerDivePolicy } from '../../src/core/input/PowerDivePolicy';
import { HomeSpringField } from '../../src/core/fluid/fields/HomeSpringField';

const STEP = 1 / 60;
const CFG = { thrustUp: 700, thrustDown: 520, thrustForward: 175, attackMs: 120, decayMs: 180 };

describe('PowerDivePolicy', () => {
  it('a dive thrusts down AND forward (+x lunge)', () => {
    const p = new PowerDivePolicy(CFG);
    p.setHold(false, true);
    for (let i = 0; i < 30; i++) p.step(STEP);
    const t = p.step(STEP);
    expect(t.dvy).toBeGreaterThan(0); // down
    expect(t.dvx).toBeGreaterThan(0); // forward
  });

  it('rising is pure vertical — no forward component', () => {
    const p = new PowerDivePolicy(CFG);
    p.setHold(true, false);
    for (let i = 0; i < 30; i++) p.step(STEP);
    const t = p.step(STEP);
    expect(t.dvy).toBeLessThan(0); // up
    expect(t.dvx).toBe(0);
  });

  it('momentum-preserving: per-step Δv stays small (never an instant set)', () => {
    const p = new PowerDivePolicy(CFG);
    const cap = Math.max(CFG.thrustUp, CFG.thrustDown, CFG.thrustForward) * STEP + 1e-9;
    for (let i = 0; i < 400; i++) {
      p.setHold(i % 7 < 3, i % 5 < 2);
      const t = p.step(STEP);
      expect(Math.abs(t.dvy)).toBeLessThanOrEqual(cap);
      expect(Math.abs(t.dvx)).toBeLessThanOrEqual(cap);
    }
  });

  it('forward lunge decays after releasing the dive', () => {
    const p = new PowerDivePolicy(CFG);
    p.setHold(false, true);
    for (let i = 0; i < 30; i++) p.step(STEP);
    p.setHold(false, false);
    for (let i = 0; i < 30; i++) p.step(STEP);
    expect(p.step(STEP).dvx).toBeCloseTo(0, 6);
  });
});

describe('HomeSpringField', () => {
  it('pulls back toward home, proportional to displacement, x-only', () => {
    const s = new HomeSpringField({ homeX: 140, k: 8 });
    expect(s.sampleForce(140, 300, 0).x).toBeCloseTo(0, 9); // at home, no pull
    const right = s.sampleForce(200, 300, 0);
    expect(right.x).toBeCloseTo(-8 * 60, 6); // pulls left
    expect(right.y).toBe(0);
    const left = s.sampleForce(100, 300, 0);
    expect(left.x).toBeCloseTo(8 * 40, 6); // pulls right
    // Farther = stronger.
    expect(Math.abs(s.sampleForce(260, 0, 0).x)).toBeGreaterThan(Math.abs(right.x));
  });
});
