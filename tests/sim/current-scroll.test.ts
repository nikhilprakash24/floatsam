import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng';
import {
  CurrentSpawner,
  ScrollingCurrentField,
  type CurrentSpawnOptions,
} from '../../src/core/fluid/currents/CurrentSpawner';

const baseOpts = (over: Partial<CurrentSpawnOptions> = {}): CurrentSpawnOptions => ({
  worldW: 480,
  worldH: 720,
  spacing: 320,
  intensity: 1,
  kinds: ['updraft', 'downwash', 'eddy-cw', 'tailwind'],
  firstX: 600,
  marginY: 160,
  ...over,
});

describe('CurrentSpawner determinism', () => {
  it('same seed ⇒ identical cell sequence after equal updates', () => {
    const a = new CurrentSpawner(baseOpts(), createRng(123));
    const b = new CurrentSpawner(baseOpts(), createRng(123));
    for (let i = 0; i < 400; i++) {
      a.update(1 / 60, 180);
      b.update(1 / 60, 180);
    }
    expect(a.cells.map((c) => c.kind)).toEqual(b.cells.map((c) => c.kind));
    a.cells.forEach((c, i) => expect(c.centerY).toBeCloseTo(b.cells[i]!.centerY, 9));
  });

  it('different seeds diverge', () => {
    const a = new CurrentSpawner(baseOpts(), createRng(1));
    const b = new CurrentSpawner(baseOpts(), createRng(2));
    // At least one cell differs in kind or center.
    const same = a.cells.every((c, i) => c.kind === b.cells[i]!.kind && c.centerY === b.cells[i]!.centerY);
    expect(same).toBe(false);
  });

  it('keeps centers inside the vertical margins', () => {
    const s = new CurrentSpawner(baseOpts(), createRng(7));
    for (let i = 0; i < 1000; i++) {
      s.update(1 / 60, 200);
      for (const c of s.cells) {
        expect(c.centerY).toBeGreaterThanOrEqual(160);
        expect(c.centerY).toBeLessThanOrEqual(720 - 160);
      }
    }
  });
});

describe('scrolling + recycle', () => {
  it('cells drift left by speed·dt', () => {
    const s = new CurrentSpawner(baseOpts(), createRng(5));
    const before = s.cells.map((c) => c.worldX);
    s.update(1 / 60, 180);
    s.cells.forEach((c, i) => expect(c.worldX).toBeCloseTo(before[i]! - 180 / 60, 6));
  });

  it('pool size is stable and cells stay on-screen-ish (recycle works)', () => {
    const s = new CurrentSpawner(baseOpts(), createRng(9));
    const n = s.cells.length;
    for (let i = 0; i < 2000; i++) s.update(1 / 60, 220);
    expect(s.cells.length).toBe(n);
    // No cell is left stranded far off the left edge.
    const minX = Math.min(...s.cells.map((c) => c.worldX));
    expect(minX).toBeGreaterThan(-400);
  });
});

describe('ScrollingCurrentField adapter', () => {
  const budgets = { up: 400, down: 260, lat: 320 };

  it('is the summed cell contribution, clamped to the budgets', () => {
    const s = new CurrentSpawner(baseOpts({ kinds: ['updraft'], spacing: 320, firstX: 240 }), createRng(3));
    const field = new ScrollingCurrentField(s, budgets.up, budgets.down, budgets.lat);
    // Put a cell exactly under the sample x by reading its worldX.
    const cell = s.cells[0]!;
    const f = field.sampleForce(cell.worldX, cell.centerY, 0);
    // Updraft ⇒ upward (−y), magnitude ≤ up budget.
    expect(f.y).toBeLessThan(0);
    expect(f.y).toBeGreaterThanOrEqual(-budgets.up - 1e-9);
    expect(Math.abs(f.x)).toBeLessThanOrEqual(budgets.lat + 1e-9);
  });

  it('clamps even absurd stacked intensity', () => {
    const s = new CurrentSpawner(baseOpts({ kinds: ['downwash'], intensity: 9, spacing: 30, firstX: 240 }), createRng(4));
    const field = new ScrollingCurrentField(s, budgets.up, budgets.down, budgets.lat);
    for (let y = 100; y < 620; y += 40) {
      const f = field.sampleForce(240, y, 0);
      expect(f.y).toBeLessThanOrEqual(budgets.down + 1e-9);
      expect(f.y).toBeGreaterThanOrEqual(-budgets.up - 1e-9);
    }
  });

  it('is localized: far from every cell the force is zero', () => {
    const s = new CurrentSpawner(baseOpts({ kinds: ['updraft'], spacing: 9999, firstX: 240 }), createRng(2));
    const field = new ScrollingCurrentField(s, budgets.up, budgets.down, budgets.lat);
    // Sample far to the left of the lone reachable cell.
    const f = field.sampleForce(-5000, 360, 0);
    expect(f).toEqual({ x: 0, y: 0 });
  });

  it('static-kind cells are time-invariant (replay guard)', () => {
    const s = new CurrentSpawner(baseOpts({ kinds: ['updraft', 'eddy-cw', 'tailwind'], firstX: 240 }), createRng(8));
    const field = new ScrollingCurrentField(s, budgets.up, budgets.down, budgets.lat);
    for (const c of s.cells) {
      const f0 = field.sampleForce(c.worldX, c.centerY, 0);
      const f1 = field.sampleForce(c.worldX, c.centerY, 12.3);
      expect(f1).toEqual(f0);
    }
  });
});
