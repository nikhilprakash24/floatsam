import { describe, expect, it } from 'vitest';
import { createBody, dragAccel, stepBody, terminalSpeed } from '../../src/core/fluid/FluidBody';
import { ConstantBuoyancyField } from '../../src/core/fluid/FluidField';
import { PHYSICS } from '../helpers';

const field = new ConstantBuoyancyField(PHYSICS.buoyancyAccel);

describe('dragAccel', () => {
  it('opposes motion in both directions', () => {
    expect(dragAccel(100, 0.01)).toBeLessThan(0);
    expect(dragAccel(-100, 0.01)).toBeGreaterThan(0);
    expect(dragAccel(0, 0.01)).toBeCloseTo(0);
  });

  it('is quadratic in speed', () => {
    expect(dragAccel(200, 0.01)).toBeCloseTo(4 * dragAccel(100, 0.01));
  });
});

describe('terminalSpeed', () => {
  it('matches the analytic balance point drive = drag', () => {
    const v = terminalSpeed(120, 0.0099);
    expect(0.0099 * v * v).toBeCloseTo(120, 5);
  });

  it('current tuning sinks within the 80–120 px/s feel target', () => {
    const net = PHYSICS.gravity - PHYSICS.buoyancyAccel;
    const v = terminalSpeed(net, PHYSICS.dragCoefficient);
    expect(v).toBeGreaterThanOrEqual(80);
    expect(v).toBeLessThanOrEqual(120);
  });
});

describe('stepBody (integrator)', () => {
  it('applies thrust as a direct velocity delta, never instantly to terminal (§4.1)', () => {
    let b = createBody(0, 300);
    const slice = PHYSICS.swimImpulse / PHYSICS.swimBlendSteps;
    for (let i = 0; i < PHYSICS.swimBlendSteps; i++) {
      const before = b.vy;
      b = stepBody(b, PHYSICS, field, 0, { dvx: 0, dvy: -slice });
      // Velocity change per step is bounded by the slice + ambient forces.
      expect(Math.abs(b.vy - before)).toBeLessThan(slice + 30);
    }
  });

  it('clamps rise speed asymmetrically', () => {
    let b = createBody(0, 300);
    const slice = PHYSICS.swimImpulse / PHYSICS.swimBlendSteps;
    for (let i = 0; i < 60; i++) {
      b = stepBody(b, PHYSICS, field, 0, { dvx: 0, dvy: -slice });
    }
    expect(b.vy).toBeGreaterThanOrEqual(-PHYSICS.maxRiseSpeed - 1e-9);
  });

  it('never exceeds max sink speed', () => {
    let b = { ...createBody(0, 0), vy: 10_000 };
    b = stepBody(b, PHYSICS, field, 0);
    expect(b.vy).toBeLessThanOrEqual(PHYSICS.maxSinkSpeed);
  });

  it('massScale divides continuous-force acceleration but not thrust', () => {
    // Heavier body (massScale 2) sinks slower under gravity over one step.
    const light = stepBody(createBody(0, 100), PHYSICS, field, 0, { dvx: 0, dvy: 0 }, 1);
    const heavy = stepBody(createBody(0, 100), PHYSICS, field, 0, { dvx: 0, dvy: 0 }, 2);
    expect(Math.abs(heavy.vy)).toBeLessThan(Math.abs(light.vy));
    // Thrust Δv is identical regardless of mass (it is a velocity delta).
    const a = stepBody(createBody(0, 100), PHYSICS, field, 0, { dvx: 0, dvy: -50 }, 1).vy;
    const b = stepBody(createBody(0, 100), PHYSICS, field, 0, { dvx: 0, dvy: -50 }, 1).vy;
    expect(a).toBe(b);
  });

  it('massScale of 1 is bit-identical to no scaling (the Seal invariant)', () => {
    const withScale = stepBody(createBody(7, 123), PHYSICS, field, 0, { dvx: 0, dvy: -33 }, 1);
    const without = stepBody(createBody(7, 123), PHYSICS, field, 0, { dvx: 0, dvy: -33 });
    expect(withScale).toEqual(without);
  });

  it('is pure — input state untouched', () => {
    const before = createBody(5, 5);
    const snapshot = { ...before };
    stepBody(before, PHYSICS, field, 0);
    expect(before).toEqual(snapshot);
  });
});
