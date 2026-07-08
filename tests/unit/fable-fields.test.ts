import { describe, expect, it } from 'vitest';
import { PulsingField } from '../../src/core/fluid/fields/PulsingField';
import { TurbulenceField } from '../../src/core/fluid/fields/TurbulenceField';
import { LaneField } from '../../src/core/fluid/fields/LaneField';
import { CenterSeekField } from '../../src/core/fluid/fields/CenterSeekField';
import { BudgetClampField } from '../../src/core/fluid/fields/BudgetClampField';
import { ZoneField } from '../../src/core/fluid/fields/ZoneField';
import { DEFAULT_KNOBS, FABLE_PRESETS } from '../../src/core/fluid/fields/fablePresets';
import { OTTER } from '../../src/core/character/CharacterProfile';
import dive from '../../src/config/modes/dive.json';
import fable from '../../src/config/fable-currents.json';

const up = new ZoneField({ shape: 'rect', x: 240, y: 360, halfW: 240, halfH: 360, dirX: 0, dirY: -1, strength: 100, falloff: 24 });

describe('PulsingField', () => {
  it('gates between floor and full strength, deterministically in t', () => {
    const p = new PulsingField(up, 4, 2, 0);
    const peakT = 1; // sin(2π·1/4)=1 → full
    expect(p.sampleForce(240, 360, peakT).y).toBeCloseTo(-100, 5);
    const troughT = 3; // sin(3π/2)=−1 → 0
    expect(p.sampleForce(240, 360, troughT).y).toBeCloseTo(0, 5);
    // Same t twice ⇒ identical (replay-safe).
    expect(p.sampleForce(240, 360, 1.234)).toEqual(p.sampleForce(240, 360, 1.234));
  });

  it('respects a non-zero floor', () => {
    const p = new PulsingField(up, 4, 2, 0.3);
    expect(Math.abs(p.sampleForce(240, 360, 3).y)).toBeCloseTo(30, 5);
  });
});

describe('TurbulenceField', () => {
  const t = new TurbulenceField(50, 96, 7);

  it('is deterministic and time-invariant', () => {
    expect(t.sampleForce(123, 456, 0)).toEqual(t.sampleForce(123, 456, 99));
  });

  it('never exceeds its strength in magnitude', () => {
    for (let x = 0; x <= 480; x += 24) {
      for (let y = 0; y <= 720; y += 24) {
        const f = t.sampleForce(x, y, 0);
        expect(Math.hypot(f.x, f.y)).toBeLessThanOrEqual(50 + 1e-9);
      }
    }
  });

  it('is locally smooth — adjacent samples never jump (no force cliffs)', () => {
    let prev = t.sampleForce(0, 300, 0);
    for (let x = 2; x <= 480; x += 2) {
      const cur = t.sampleForce(x, 300, 0);
      expect(Math.hypot(cur.x - prev.x, cur.y - prev.y)).toBeLessThan(6);
      prev = cur;
    }
  });
});

describe('LaneField', () => {
  it('alternates direction across lane height, smoothly, capped at strength', () => {
    const l = new LaneField(150, 180);
    expect(l.sampleForce(0, 90, 0).x).toBeCloseTo(150, 5); // mid-lane peak
    expect(l.sampleForce(0, 270, 0).x).toBeCloseTo(-150, 5); // next lane opposes
    expect(Math.abs(l.sampleForce(0, 180, 0).x)).toBeLessThan(1e-9); // boundary = 0
  });
});

describe('CenterSeekField', () => {
  it('restores toward center and caps', () => {
    const c = new CenterSeekField(360, 1, 100);
    expect(c.sampleForce(0, 460, 0).y).toBeLessThan(0); // below → push up
    expect(c.sampleForce(0, 260, 0).y).toBeGreaterThan(0); // above → push down
    expect(Math.abs(c.sampleForce(0, 720, 0).y)).toBe(100); // capped
  });
});

describe('BudgetClampField', () => {
  it('clamps down/up/lateral components independently', () => {
    const wild = { sampleForce: () => ({ x: 999, y: 999 }) };
    const clamped = new BudgetClampField(wild, 100, 50, 80);
    expect(clamped.sampleForce(0, 0, 0)).toEqual({ x: 80, y: 50 });
    const wildUp = { sampleForce: () => ({ x: -999, y: -999 }) };
    expect(new BudgetClampField(wildUp, 100, 50, 80).sampleForce(0, 0, 0)).toEqual({ x: -80, y: -100 });
  });
});

describe('Fable presets — knob extremes stay inside the Otter budgets', () => {
  const T_UP = dive.biaxial.thrustUp * OTTER.thrustScale;
  const T_DOWN = dive.biaxial.thrustDown * OTTER.thrustScale;
  const LIM = {
    up: T_UP * fable.budgets.upFrac,
    down: T_DOWN * fable.budgets.downFrac,
    lat: T_UP * fable.budgets.latFrac,
  };

  const extremes = [
    { ...DEFAULT_KNOBS, intensity: 1.5, assistBias: 1, turbulence: 120, pulsePeriod: 1 },
    { ...DEFAULT_KNOBS, intensity: 1.5, assistBias: -1, turbulence: 120, pulsePeriod: 8 },
  ];

  for (const preset of FABLE_PRESETS) {
    it(`${preset.id} is budget-safe at max knobs (spatial × time sweep)`, () => {
      for (const knobs of extremes) {
        const field = preset.build(knobs);
        for (const t of [0, 0.7, 1.9, 3.3, 6.1]) {
          for (let x = 0; x <= 480; x += 32) {
            for (let y = 0; y <= 720; y += 32) {
              const f = field.sampleForce(x, y, t);
              expect(f.y, `${preset.id} down`).toBeLessThanOrEqual(LIM.down + 1e-6);
              expect(-f.y, `${preset.id} up`).toBeLessThanOrEqual(LIM.up + 1e-6);
              expect(Math.abs(f.x), `${preset.id} lat`).toBeLessThanOrEqual(LIM.lat + 1e-6);
            }
          }
        }
      }
    });
  }

  it('replay determinism: same (x,y,t) twice ⇒ identical force on every preset', () => {
    for (const preset of FABLE_PRESETS) {
      const field = preset.build(DEFAULT_KNOBS);
      expect(field.sampleForce(200, 300, 2.5)).toEqual(field.sampleForce(200, 300, 2.5));
    }
  });
});
