import { describe, expect, it } from 'vitest';
import { clampsFor } from '../../src/core/spawn/clampsFor';
import { CLASSIC_MODE } from '../../src/core/modes/classicMode';
import { DIVE_MODE } from '../../src/core/modes/diveMode';
import { SEAL, OTTER } from '../../src/core/character/CharacterProfile';

describe('clampsFor (per-pair reachability)', () => {
  it('Seal × Classic reproduces the shipped {100, 45} EXACTLY (locked)', () => {
    const c = clampsFor(SEAL, CLASSIC_MODE);
    expect(c.maxRisePerSecond).toBe(100);
    expect(c.maxSinkPerSecond).toBe(45);
  });

  it('Otter × Classic: weaker rise (flap power), faster sink (lighter, less drag)', () => {
    const c = clampsFor(OTTER, CLASSIC_MODE);
    // Rise scales with thrustScale 0.72.
    expect(c.maxRisePerSecond).toBeCloseTo(100 * 0.72, 9);
    // Otter sinks faster than the Seal → looser down clamp than 45.
    expect(c.maxSinkPerSecond).toBeGreaterThan(45);
  });

  it('Dive: both axes scale with flap power (active up AND down)', () => {
    const seal = clampsFor(SEAL, DIVE_MODE);
    expect(seal.maxRisePerSecond).toBe(DIVE_MODE.spawn.maxRisePerSecond);
    expect(seal.maxSinkPerSecond).toBe(DIVE_MODE.spawn.maxSinkPerSecond);

    const otter = clampsFor(OTTER, DIVE_MODE);
    expect(otter.maxRisePerSecond).toBeCloseTo(DIVE_MODE.spawn.maxRisePerSecond * 0.72, 9);
    expect(otter.maxSinkPerSecond).toBeCloseTo(DIVE_MODE.spawn.maxSinkPerSecond * 0.72, 9);
  });
});
