import { describe, expect, it } from 'vitest';
import {
  CHARACTERS,
  SEAL,
  TRAIT_ORDER,
  deriveEffective,
  overallRating,
  type CharacterProfile,
} from '../../src/core/character/CharacterProfile';
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
      card: {
        number: '00',
        role: 'Test',
        rarity: 'common',
        flavor: '',
        traits: { power: 3, agility: 3, glide: 3, float: 3, stealth: 3 },
      },
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

describe('character cards (trait/score presentation)', () => {
  it('every roster character has a complete, in-range trait card', () => {
    for (const c of CHARACTERS) {
      expect(c.card.number).toBeTruthy();
      expect(c.card.role).toBeTruthy();
      expect(c.card.flavor.length).toBeGreaterThan(0);
      for (const key of TRAIT_ORDER) {
        const v = c.card.traits[key];
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(5);
      }
    }
  });

  it('roster ids are unique', () => {
    const ids = CHARACTERS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('overall rating is the trait mean mapped to 20–99', () => {
    expect(overallRating(SEAL.card)).toBe(59); // all 3s → mean 3 → 59
    for (const c of CHARACTERS) {
      const ovr = overallRating(c.card);
      expect(ovr).toBeGreaterThanOrEqual(20);
      expect(ovr).toBeLessThanOrEqual(99);
    }
  });

  it('the characters are genuinely distinct (no two share a trait block)', () => {
    const blocks = CHARACTERS.map((c) => TRAIT_ORDER.map((k) => c.card.traits[k]).join(','));
    expect(new Set(blocks).size).toBe(blocks.length);
  });
});
