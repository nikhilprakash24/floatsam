import { describe, expect, it } from 'vitest';
import { MODES, modeById } from '../../src/core/modes/modes';
import { CHARACTERS, characterById, SEAL } from '../../src/core/character/CharacterProfile';
import { CLASSIC_MODE } from '../../src/core/modes/classicMode';

describe('mode registry', () => {
  it('exposes the three public modes with unique ids', () => {
    expect(MODES.map((m) => m.id)).toEqual(['classic', 'dive', 'powerdive']);
    expect(new Set(MODES.map((m) => m.id)).size).toBe(MODES.length);
  });

  it('modeById resolves ids and falls back to Classic for unknowns', () => {
    expect(modeById('dive').id).toBe('dive');
    expect(modeById('nope')).toBe(CLASSIC_MODE);
    expect(modeById(null)).toBe(CLASSIC_MODE);
    expect(modeById(undefined)).toBe(CLASSIC_MODE);
  });
});

describe('character registry', () => {
  it('exposes the four-creature roster with unique ids', () => {
    expect(CHARACTERS.map((c) => c.id)).toEqual(['seal', 'otter', 'puffer', 'sealion']);
  });

  it('characterById resolves ids and falls back to Seal for unknowns', () => {
    expect(characterById('puffer').id).toBe('puffer');
    expect(characterById('nope')).toBe(SEAL);
    expect(characterById(null)).toBe(SEAL);
  });
});
