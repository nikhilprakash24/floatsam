import { describe, expect, it } from 'vitest';
import { createRng, rngRange } from '../../src/core/rng';

describe('createRng', () => {
  it('same seed produces identical sequences', () => {
    const a = createRng(1234);
    const b = createRng(1234);
    for (let i = 0; i < 1000; i++) expect(a()).toBe(b());
  });

  it('different seeds diverge', () => {
    const a = createRng(1);
    const b = createRng(2);
    const seqA = Array.from({ length: 10 }, a);
    const seqB = Array.from({ length: 10 }, b);
    expect(seqA).not.toEqual(seqB);
  });

  it('outputs stay in [0, 1)', () => {
    const r = createRng(42);
    for (let i = 0; i < 10_000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('rngRange', () => {
  it('respects bounds', () => {
    const r = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rngRange(r, 150, 570);
      expect(v).toBeGreaterThanOrEqual(150);
      expect(v).toBeLessThan(570);
    }
  });
});
