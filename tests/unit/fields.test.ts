import { describe, expect, it } from 'vitest';
import { ZoneField } from '../../src/core/fluid/fields/ZoneField';
import { VortexField } from '../../src/core/fluid/fields/VortexField';
import { CompositeField } from '../../src/core/fluid/fields/CompositeField';
import { smoothstep } from '../../src/core/fluid/fields/math';

describe('smoothstep', () => {
  it('clamps below/above and is monotonic with zero end-slopes', () => {
    expect(smoothstep(0, 10, -5)).toBe(0);
    expect(smoothstep(0, 10, 15)).toBe(1);
    expect(smoothstep(0, 10, 5)).toBeCloseTo(0.5, 6);
    let prev = -1;
    for (let x = 0; x <= 10; x += 0.5) {
      const v = smoothstep(0, 10, x);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe('ZoneField (rect)', () => {
  const zone = new ZoneField({
    shape: 'rect',
    x: 240,
    y: 360,
    halfW: 120,
    halfH: 100,
    dirX: 0,
    dirY: 1,
    strength: 200,
    falloff: 40,
  });

  it('full strength deep inside, zero outside', () => {
    expect(zone.sampleForce(240, 360, 0).y).toBeCloseTo(200, 6);
    expect(zone.sampleForce(240, 360, 0).x).toBe(0);
    expect(zone.sampleForce(0, 0, 0)).toEqual({ x: 0, y: 0 });
  });

  it('normalizes the direction vector', () => {
    const diag = new ZoneField({ shape: 'circle', x: 0, y: 0, radius: 100, dirX: 3, dirY: 4, strength: 50, falloff: 24 });
    const f = diag.sampleForce(0, 0, 0);
    expect(Math.hypot(f.x, f.y)).toBeCloseTo(50, 6);
  });

  it('no force cliffs: crossing the edge is continuous (small per-step delta)', () => {
    let prev = zone.sampleForce(240, 200, 0).y; // above the top edge region
    let maxJump = 0;
    for (let y = 200; y <= 360; y += 1) {
      const cur = zone.sampleForce(240, y, 0).y;
      maxJump = Math.max(maxJump, Math.abs(cur - prev));
      prev = cur;
    }
    expect(maxJump).toBeLessThan(12); // smooth ramp, not a step
  });
});

describe('VortexField', () => {
  const v = new VortexField({ x: 240, y: 360, radius: 100, strength: 150, direction: 1, maxAccel: 200 });

  it('pure swirl is tangential (perpendicular to the radius)', () => {
    for (const [px, py] of [[300, 360], [240, 420], [180, 300]] as const) {
      const f = v.sampleForce(px, py, 0);
      const rx = px - 240;
      const ry = py - 360;
      const dot = f.x * rx + f.y * ry;
      expect(Math.abs(dot)).toBeLessThan(1e-6); // no radial component
    }
  });

  it('solid-body inside: tangential speed grows ∝ r/R', () => {
    const near = Math.hypot(...Object.values(v.sampleForce(240 + 25, 360, 0)) as [number, number]);
    const far = Math.hypot(...Object.values(v.sampleForce(240 + 75, 360, 0)) as [number, number]);
    expect(far).toBeGreaterThan(near);
    expect(near).toBeCloseTo(150 * (25 / 100), 4);
  });

  it('never exceeds the magnitude cap', () => {
    const strong = new VortexField({ x: 0, y: 0, radius: 50, strength: 999, direction: -1, inflow: 999, maxAccel: 120 });
    for (let a = 0; a < 6.28; a += 0.3) {
      const f = strong.sampleForce(Math.cos(a) * 30, Math.sin(a) * 30, 0);
      expect(Math.hypot(f.x, f.y)).toBeLessThanOrEqual(120 + 1e-9);
    }
  });
});

describe('CompositeField', () => {
  it('is the exact vector sum of its children', () => {
    const a = new ZoneField({ shape: 'circle', x: 0, y: 0, radius: 500, dirX: 1, dirY: 0, strength: 30, falloff: 24 });
    const b = new VortexField({ x: 0, y: 0, radius: 100, strength: 40, direction: 1, maxAccel: 999 });
    const comp = new CompositeField([a, b]);
    const fa = a.sampleForce(60, 20, 0);
    const fb = b.sampleForce(60, 20, 0);
    const fc = comp.sampleForce(60, 20, 0);
    expect(fc.x).toBeCloseTo(fa.x + fb.x, 9);
    expect(fc.y).toBeCloseTo(fa.y + fb.y, 9);
  });
});

describe('time-determinism (replay-drift guard)', () => {
  it('static fields ignore t — identical force at any time', () => {
    const comp = new CompositeField([
      new ZoneField({ shape: 'rect', x: 240, y: 360, halfW: 100, halfH: 80, dirX: 1, dirY: 0.3, strength: 90, falloff: 30 }),
      new VortexField({ x: 300, y: 300, radius: 120, strength: 80, direction: -1, inflow: 10, maxAccel: 150 }),
    ]);
    for (const [x, y] of [[100, 100], [240, 360], [400, 500]] as const) {
      const f0 = comp.sampleForce(x, y, 0);
      const f1 = comp.sampleForce(x, y, 12.34);
      expect(f1).toEqual(f0);
    }
  });
});
