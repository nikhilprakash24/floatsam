import { describe, expect, it } from 'vitest';
import {
  CURRENT_CATALOG,
  SHIPPING_PATTERNS,
  DEFAULT_CATALOG_KNOBS,
  patternById,
} from '../../src/core/fluid/currents/catalog';

const W = 480;
const H = 720;

describe('currents catalog', () => {
  it('has exactly 20 patterns with unique ids and numbering 1..20', () => {
    expect(CURRENT_CATALOG).toHaveLength(20);
    const ids = new Set(CURRENT_CATALOG.map((p) => p.id));
    expect(ids.size).toBe(20);
    expect(CURRENT_CATALOG.map((p) => p.n).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
  });

  it('every pattern builds a field returning finite vectors across the column', () => {
    for (const p of CURRENT_CATALOG) {
      const field = p.build(DEFAULT_CATALOG_KNOBS);
      for (let x = 20; x < W; x += 80) {
        for (let y = 20; y < H; y += 80) {
          for (const t of [0, 1.3, 7.7]) {
            const f = field.sampleForce(x, y, t);
            expect(Number.isFinite(f.x)).toBe(true);
            expect(Number.isFinite(f.y)).toBe(true);
          }
        }
      }
    }
  });

  it('intensity is a monotone strength dial (0 → no force, higher → not weaker)', () => {
    // Sample at each pattern's center where its force is strongest.
    for (const p of CURRENT_CATALOG) {
      const zero = p.build({ intensity: 0 });
      const mid = p.build({ intensity: 1 });
      const hi = p.build({ intensity: 1.6 });
      const probe = (field: ReturnType<typeof p.build>): number => {
        let peak = 0;
        for (let x = 40; x < W; x += 40)
          for (let y = 40; y < H; y += 40) {
            const f = field.sampleForce(x, y, 0.5);
            peak = Math.max(peak, Math.hypot(f.x, f.y));
          }
        return peak;
      };
      expect(probe(zero)).toBeCloseTo(0, 5);
      expect(probe(hi)).toBeGreaterThanOrEqual(probe(mid) - 1e-6);
    }
  });

  it('classifications are coherent: helpful and hostile patterns both exist', () => {
    const helpful = CURRENT_CATALOG.filter((p) => p.disposition === 'helpful');
    const hostile = CURRENT_CATALOG.filter((p) => p.disposition === 'hostile');
    expect(helpful.length).toBeGreaterThanOrEqual(5);
    expect(hostile.length).toBeGreaterThanOrEqual(8);
  });

  it('the only screen-scope pattern is the rare Surge', () => {
    const screen = CURRENT_CATALOG.filter((p) => p.scope === 'screen');
    expect(screen).toHaveLength(1);
    expect(screen[0]!.id).toBe('the-surge');
    expect(screen[0]!.game).toBe('rare');
  });

  it('SHIPPING_PATTERNS are the game:"ship" cells and none are screen-scope', () => {
    expect(SHIPPING_PATTERNS.length).toBeGreaterThan(0);
    for (const p of SHIPPING_PATTERNS) {
      expect(p.game).toBe('ship');
      expect(p.scope).not.toBe('screen');
    }
  });

  it('patternById round-trips and throws on unknown', () => {
    expect(patternById('updraft-vent').name).toBe('Updraft Vent');
    expect(() => patternById('nope')).toThrow();
  });
});
