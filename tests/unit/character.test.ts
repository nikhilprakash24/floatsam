import { describe, expect, it } from 'vitest';
import { SEAL, deriveEffective, type CharacterProfile } from '../../src/core/character/CharacterProfile';
import { PHYSICS } from '../helpers';

describe('CharacterProfile derivation', () => {
  it('the Seal is the identity: all scales 1.0', () => {
    expect(SEAL.massScale).toBe(1);
    expect(SEAL.thrustScale).toBe(1);
    expect(SEAL.dragScale).toBe(1);
    expect(SEAL.buoyancyScale).toBe(1);
  });

  it('Seal effective integrator config is bit-identical to the base (base × 1.0)', () => {
    const eff = deriveEffective(PHYSICS, SEAL);
    expect(eff.gravity).toBe(PHYSICS.gravity);
    expect(eff.buoyancyAccel).toBe(PHYSICS.buoyancyAccel);
    expect(eff.dragCoefficient).toBe(PHYSICS.dragCoefficient);
    expect(eff.swimImpulse).toBe(PHYSICS.swimImpulse);
    expect(eff.swimBlendSteps).toBe(PHYSICS.swimBlendSteps);
    expect(eff.maxRiseSpeed).toBe(PHYSICS.maxRiseSpeed);
    expect(eff.maxSinkSpeed).toBe(PHYSICS.maxSinkSpeed);
    expect(eff.massScale).toBe(1);
  });

  it('scales map onto the right base quantities', () => {
    const otterish: CharacterProfile = {
      id: 'x',
      name: 'X',
      massScale: 0.8,
      thrustScale: 0.72,
      dragScale: 0.9,
      buoyancyScale: 0.95,
      hitboxRadius: 15.2,
    };
    const eff = deriveEffective(PHYSICS, otterish);
    expect(eff.swimImpulse).toBeCloseTo(PHYSICS.swimImpulse * 0.72, 9);
    expect(eff.dragCoefficient).toBeCloseTo(PHYSICS.dragCoefficient * 0.9, 12);
    expect(eff.buoyancyAccel).toBeCloseTo(PHYSICS.buoyancyAccel * 0.95, 9);
    expect(eff.massScale).toBe(0.8);
    expect(eff.hitboxRadius).toBe(15.2);
    // Gravity is a world constant, not character-scaled.
    expect(eff.gravity).toBe(PHYSICS.gravity);
  });
});
