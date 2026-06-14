import { describe, expect, it } from 'vitest';
import { BiAxialPolicy, type BiAxialConfig } from '../../src/core/input/BiAxialPolicy';

const STEP = 1 / 60;
const CFG: BiAxialConfig = { thrustUp: 700, thrustDown: 520, attackMs: 120, decayMs: 180 };

describe('BiAxialPolicy', () => {
  it('momentum-preservation: per-step thrust Δv is always small, never an instant set', () => {
    const p = new BiAxialPolicy(CFG);
    const cap = Math.max(CFG.thrustUp, CFG.thrustDown) * STEP + 1e-9;
    // Arbitrary, deterministic input churn.
    for (let i = 0; i < 600; i++) {
      p.setHold(i % 7 < 3, i % 5 < 2);
      const dv = p.step(STEP);
      expect(Math.abs(dv.dvy)).toBeLessThanOrEqual(cap);
      expect(dv.dvx).toBe(0);
    }
  });

  it('thrust ramps in over attackMs rather than engaging instantly', () => {
    const p = new BiAxialPolicy(CFG);
    p.setHold(true, false);
    const first = -p.step(STEP).dvy / STEP; // upward accel after 1 frame
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(CFG.thrustUp); // not yet at full thrust
    // After ~attackMs it should reach (near) full thrust.
    for (let i = 0; i < Math.ceil(CFG.attackMs / 1000 / STEP) + 2; i++) p.step(STEP);
    const full = -p.step(STEP).dvy / STEP;
    expect(full).toBeCloseTo(CFG.thrustUp, 5);
  });

  it('down thrust is the headline force but weaker than up (descents are scarce, §3.5)', () => {
    expect(CFG.thrustDown).toBeLessThan(CFG.thrustUp);
    const p = new BiAxialPolicy(CFG);
    p.setHold(false, true);
    for (let i = 0; i < 60; i++) p.step(STEP);
    expect(p.step(STEP).dvy).toBeGreaterThan(0); // pushing down
  });

  it('a reversal does not snap — thrust decays through zero before building the other way', () => {
    const p = new BiAxialPolicy(CFG);
    p.setHold(true, false);
    for (let i = 0; i < 30; i++) p.step(STEP);
    const beforeReversal = p.step(STEP).dvy; // strongly negative (up)
    p.setHold(false, true);
    const justAfter = p.step(STEP).dvy;
    // One frame after reversal it is still net-upward or near zero, not full down.
    expect(justAfter).toBeGreaterThan(beforeReversal);
    expect(justAfter).toBeLessThan(CFG.thrustDown * STEP);
  });

  it('opposing holds cancel (straddling mid-screen)', () => {
    const p = new BiAxialPolicy(CFG);
    p.setHold(true, true);
    expect(p.step(STEP).dvy).toBe(0);
  });

  it('reset zeroes the ramp state', () => {
    const p = new BiAxialPolicy(CFG);
    p.setHold(true, false);
    for (let i = 0; i < 20; i++) p.step(STEP);
    p.reset();
    p.setHold(false, false);
    expect(p.step(STEP).dvy).toBe(0);
  });
});
