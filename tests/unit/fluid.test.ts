import { describe, expect, it } from 'vitest';
import {
  applySwimImpulse,
  createBody,
  dragAccel,
  stepBody,
  terminalSpeed,
} from '../../src/core/fluid/FluidBody';
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

describe('applySwimImpulse', () => {
  it('queues the configured impulse', () => {
    const b = applySwimImpulse(createBody(0, 0), PHYSICS);
    expect(b.pendingImpulse).toBe(PHYSICS.swimImpulse);
  });

  it('tops up rather than stacking unboundedly on tap spam', () => {
    let b = applySwimImpulse(createBody(0, 0), PHYSICS);
    b = applySwimImpulse(b, PHYSICS);
    b = applySwimImpulse(b, PHYSICS);
    expect(b.pendingImpulse).toBe(PHYSICS.swimImpulse);
  });

  it('does not mutate its input (pure)', () => {
    const before = createBody(0, 0);
    applySwimImpulse(before, PHYSICS);
    expect(before.pendingImpulse).toBe(0);
  });
});

describe('stepBody', () => {
  it('blends the impulse over swimBlendSteps, never instantly (§4.1)', () => {
    let b = applySwimImpulse(createBody(0, 300), PHYSICS);
    const perStep = PHYSICS.swimImpulse / PHYSICS.swimBlendSteps;
    for (let i = 0; i < PHYSICS.swimBlendSteps; i++) {
      const before = b.vy;
      b = stepBody(b, PHYSICS, field, 0);
      // Velocity change per step is bounded by the blended slice + ambient forces.
      expect(Math.abs(b.vy - before)).toBeLessThan(perStep + 30);
    }
    expect(b.pendingImpulse).toBeCloseTo(0, 6);
  });

  it('clamps rise speed asymmetrically', () => {
    let b = createBody(0, 300);
    for (let i = 0; i < 60; i++) {
      b = applySwimImpulse(b, PHYSICS);
      b = stepBody(b, PHYSICS, field, 0);
    }
    expect(b.vy).toBeGreaterThanOrEqual(-PHYSICS.maxRiseSpeed - 1e-9);
  });

  it('never exceeds max sink speed', () => {
    let b = { ...createBody(0, 0), vy: 10_000 };
    b = stepBody(b, PHYSICS, field, 0);
    expect(b.vy).toBeLessThanOrEqual(PHYSICS.maxSinkSpeed);
  });

  it('is pure — input state untouched', () => {
    const before = createBody(5, 5);
    const snapshot = { ...before };
    stepBody(before, PHYSICS, field, 0);
    expect(before).toEqual(snapshot);
  });
});
