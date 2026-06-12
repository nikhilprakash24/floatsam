import { describe, expect, it } from 'vitest';
import { GateSpawner, gapSizeFor, scrollSpeedFor } from '../../src/core/spawn/Spawner';
import { createRng } from '../../src/core/rng';
import { DIFFICULTY } from '../helpers';

const dt = 1 / 60;

describe('difficulty curves', () => {
  it('speed ramps monotonically and saturates at max', () => {
    let prev = -Infinity;
    for (let s = 0; s <= 100; s++) {
      const v = scrollSpeedFor(s, DIFFICULTY);
      expect(v).toBeGreaterThanOrEqual(prev);
      expect(v).toBeLessThanOrEqual(DIFFICULTY.scrollSpeedMax);
      prev = v;
    }
    expect(scrollSpeedFor(1000, DIFFICULTY)).toBe(DIFFICULTY.scrollSpeedMax);
  });

  it('gap shrinks monotonically and never below gapMin', () => {
    let prev = Infinity;
    for (let s = 0; s <= 100; s++) {
      const g = gapSizeFor(s, DIFFICULTY);
      expect(g).toBeLessThanOrEqual(prev);
      expect(g).toBeGreaterThanOrEqual(DIFFICULTY.gapMin);
      prev = g;
    }
    expect(gapSizeFor(1000, DIFFICULTY)).toBe(DIFFICULTY.gapMin);
  });
});

describe('GateSpawner', () => {
  it('is object-pooled: gate identities never change after construction', () => {
    const sp = new GateSpawner(DIFFICULTY, createRng(99));
    const pool = new Set(sp.gates);
    for (let i = 0; i < 60 * 120; i++) sp.update(dt, 10);
    for (const g of sp.gates) expect(pool.has(g)).toBe(true);
    expect(sp.gates.length).toBe(pool.size);
  });

  it('keeps gates spaced by spawnSpacing', () => {
    const sp = new GateSpawner(DIFFICULTY, createRng(5));
    for (let i = 0; i < 60 * 60; i++) {
      sp.update(dt, 0);
      const xs = sp.gates.map((g) => g.x).sort((a, b) => a - b);
      for (let j = 1; j < xs.length; j++) {
        expect(xs[j]! - xs[j - 1]!).toBeCloseTo(DIFFICULTY.spawnSpacing, 5);
      }
    }
  });

  it('gap always fits fully inside the water column', () => {
    const sp = new GateSpawner(DIFFICULTY, createRng(31337));
    for (let i = 0; i < 60 * 300; i++) {
      sp.update(dt, Math.floor(i / 600));
      for (const g of sp.gates) {
        expect(g.gapCenterY - g.gapSize / 2).toBeGreaterThanOrEqual(0);
        expect(g.gapCenterY + g.gapSize / 2).toBeLessThanOrEqual(DIFFICULTY.worldHeight);
      }
    }
  });

  it('fairness clamp: consecutive gap centers stay within reachable delta', { timeout: 60_000 }, () => {
    const violations: number[] = [];
    for (let seed = 1; seed <= 12; seed++) {
      const sp = new GateSpawner(DIFFICULTY, createRng(seed));
      const score = 50; // worst case: fastest scroll, tightest time between gates
      const speed = scrollSpeedFor(score, DIFFICULTY);
      const t = DIFFICULTY.spawnSpacing / speed;
      const maxUp = DIFFICULTY.maxRisePerSecond * t * DIFFICULTY.fairnessSafety;
      const maxDown = DIFFICULTY.maxSinkPerSecond * t * DIFFICULTY.fairnessSafety;

      // Warm up: construction-time gates were generated with the score-0
      // (slower, looser) bound; let the pool fully recycle at this score.
      for (let i = 0; i < 60 * 20; i++) sp.update(dt, score);

      for (let i = 0; i < 60 * 60; i++) {
        sp.update(dt, score);
        if (i % 5 !== 0) continue;
        const ordered = [...sp.gates].sort((a, b) => a.x - b.x);
        for (let j = 1; j < ordered.length; j++) {
          const delta = ordered[j]!.gapCenterY - ordered[j - 1]!.gapCenterY;
          if (delta < -maxUp - 1e-6 || delta > maxDown + 1e-6) violations.push(delta);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('same seed produces identical gate streams (determinism)', () => {
    const a = new GateSpawner(DIFFICULTY, createRng(2024));
    const b = new GateSpawner(DIFFICULTY, createRng(2024));
    for (let i = 0; i < 60 * 60; i++) {
      a.update(dt, 3);
      b.update(dt, 3);
    }
    expect(a.gates.map((g) => ({ x: g.x, c: g.gapCenterY, s: g.gapSize }))).toEqual(
      b.gates.map((g) => ({ x: g.x, c: g.gapCenterY, s: g.gapSize })),
    );
  });
});
