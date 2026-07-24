import { describe, expect, it } from 'vitest';
import { CapsuleField } from '../../src/core/fluid/fields/CapsuleField';
import { RadialField } from '../../src/core/fluid/fields/RadialField';
import { WedgeField } from '../../src/core/fluid/fields/WedgeField';
import { RingField } from '../../src/core/fluid/fields/RingField';
import { GradientBandField } from '../../src/core/fluid/fields/GradientBandField';

/**
 * C1 shape primitives (currents program). Each must be: pure in (x,y,t),
 * full-strength on its axis, zero outside its region, and cliff-free at the
 * edge (small per-step delta), so they compose safely under the budget clamp.
 */

const mag = (f: { x: number; y: number }): number => Math.hypot(f.x, f.y);

describe('CapsuleField', () => {
  const cap = new CapsuleField({
    x: 240, y: 360, halfLen: 100, angle: 0, radius: 40, dirX: 1, dirY: 0, strength: 200, falloff: 30,
  });

  it('full strength on the axis, zero well outside', () => {
    expect(cap.sampleForce(240, 360, 0).x).toBeCloseTo(200, 6);
    expect(cap.sampleForce(240, 360, 0).y).toBe(0);
    expect(cap.sampleForce(240, 500, 0)).toEqual({ x: 0, y: 0 }); // beyond thickness
    expect(cap.sampleForce(500, 360, 0)).toEqual({ x: 0, y: 0 }); // beyond the rounded end
  });

  it('rounded end: falls off past halfLen like a capsule cap, not a hard cut', () => {
    const onAxisEnd = cap.sampleForce(340, 360, 0).x; // exactly at the end center
    expect(onAxisEnd).toBeCloseTo(200, 6); // still full: distance to segment is 0
    const beyond = cap.sampleForce(340 + 40, 360, 0).x; // one radius past the end
    expect(beyond).toBe(0);
  });

  it('normalizes an unnormalized direction', () => {
    const diag = new CapsuleField({ x: 0, y: 0, halfLen: 50, angle: 0, radius: 50, dirX: 3, dirY: 4, strength: 100, falloff: 24 });
    expect(mag(diag.sampleForce(0, 0, 0))).toBeCloseTo(100, 6);
  });

  it('no force cliffs crossing the thickness edge', () => {
    let prev = cap.sampleForce(240, 300, 0).x;
    let maxJump = 0;
    for (let y = 300; y <= 360; y += 1) {
      const cur = cap.sampleForce(240, y, 0).x;
      maxJump = Math.max(maxJump, Math.abs(cur - prev));
      prev = cur;
    }
    expect(maxJump).toBeLessThan(12);
  });
});

describe('RadialField (source / sink)', () => {
  const boil = new RadialField({ x: 240, y: 360, radius: 120, strength: 150, falloff: 30 });
  const drain = new RadialField({ x: 240, y: 360, radius: 120, strength: -150, falloff: 30 });

  it('source points outward, sink points inward', () => {
    const outward = boil.sampleForce(300, 360, 0); // to the right of center
    expect(outward.x).toBeGreaterThan(0);
    const inward = drain.sampleForce(300, 360, 0);
    expect(inward.x).toBeLessThan(0);
  });

  it('purely radial (no tangential component)', () => {
    for (const [px, py] of [[300, 360], [240, 300], [280, 400]] as const) {
      const f = boil.sampleForce(px, py, 0);
      const rx = px - 240;
      const ry = py - 360;
      const cross = f.x * ry - f.y * rx; // radial ⇒ zero cross product with radius
      expect(Math.abs(cross)).toBeLessThan(1e-6);
    }
  });

  it('zero at the exact center (avoids a divide-by-zero singularity) and outside', () => {
    expect(boil.sampleForce(240, 360, 0)).toEqual({ x: 0, y: 0 });
    expect(boil.sampleForce(240, 999, 0)).toEqual({ x: 0, y: 0 });
  });

  it('never exceeds the cap', () => {
    const capped = new RadialField({ x: 0, y: 0, radius: 100, strength: 999, falloff: 24, maxAccel: 80 });
    for (let a = 0; a < 6.28; a += 0.4) {
      expect(mag(capped.sampleForce(Math.cos(a) * 20, Math.sin(a) * 20, 0))).toBeLessThanOrEqual(80 + 1e-9);
    }
  });
});

describe('WedgeField (ramp)', () => {
  const wedge = new WedgeField({
    x: 240, y: 360, halfW: 120, halfH: 100, rampAxis: 'x', rampDir: 1, dirX: 0, dirY: -1, strength: 300, falloff: 30,
  });

  it('weak at the −axis end, strong at the +axis end', () => {
    const weak = Math.abs(wedge.sampleForce(240 - 90, 360, 0).y);
    const strong = Math.abs(wedge.sampleForce(240 + 90, 360, 0).y);
    expect(strong).toBeGreaterThan(weak);
  });

  it('ramp is monotonic along its axis (interior)', () => {
    let prev = -1;
    for (let x = 240 - 80; x <= 240 + 80; x += 5) {
      const v = Math.abs(wedge.sampleForce(x, 360, 0).y);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = v;
    }
  });

  it('zero outside the rectangle', () => {
    expect(wedge.sampleForce(240, 999, 0)).toEqual({ x: 0, y: 0 });
    expect(wedge.sampleForce(999, 360, 0)).toEqual({ x: 0, y: 0 });
  });
});

describe('RingField (annulus)', () => {
  const ring = new RingField({ x: 240, y: 360, radius: 100, band: 30, strength: 120, direction: 1 });

  it('peaks on the ring, zero at the center and far outside', () => {
    const onRing = mag(ring.sampleForce(240 + 100, 360, 0));
    expect(onRing).toBeCloseTo(120, 4);
    expect(ring.sampleForce(240, 360, 0)).toEqual({ x: 0, y: 0 }); // center
    expect(ring.sampleForce(240 + 200, 360, 0)).toEqual({ x: 0, y: 0 }); // outside band
  });

  it('tangential (perpendicular to the radius)', () => {
    for (const [px, py] of [[340, 360], [240, 460], [170, 290]] as const) {
      const f = ring.sampleForce(px, py, 0);
      const dot = f.x * (px - 240) + f.y * (py - 360);
      expect(Math.abs(dot)).toBeLessThan(1e-6);
    }
  });

  it('spin direction flips with sign', () => {
    const cw = new RingField({ x: 0, y: 0, radius: 100, band: 30, strength: 100, direction: -1 });
    const f = cw.sampleForce(100, 0, 0); // at +x, CW ⇒ downward (+y screen)
    expect(f.y).toBeLessThan(0);
    const ccw = ring.sampleForce(240 + 100, 360, 0); // at +x, CCW ⇒ upward (−y? sign check)
    expect(ccw.y).toBeGreaterThan(0);
  });
});

describe('GradientBandField (shear)', () => {
  const shear = new GradientBandField({ x: 240, y: 360, halfW: 120, halfH: 100, strength: 200, falloff: 30 });

  it('reverses across the mid-line with a smooth zero-cross', () => {
    const top = shear.sampleForce(240, 360 - 80, 0).x;
    const bottom = shear.sampleForce(240, 360 + 80, 0).x;
    expect(Math.sign(top)).toBe(-Math.sign(bottom));
    expect(Math.abs(shear.sampleForce(240, 360, 0).x)).toBeLessThan(1e-6); // seam
  });

  it('zero outside the rectangle', () => {
    expect(shear.sampleForce(240, 999, 0)).toEqual({ x: 0, y: 0 });
    expect(shear.sampleForce(999, 360, 0)).toEqual({ x: 0, y: 0 });
  });

  it('no force cliffs across the shear seam', () => {
    let prev = shear.sampleForce(240, 360 - 90, 0).x;
    let maxJump = 0;
    for (let y = 360 - 90; y <= 360 + 90; y += 1) {
      const cur = shear.sampleForce(240, y, 0).x;
      maxJump = Math.max(maxJump, Math.abs(cur - prev));
      prev = cur;
    }
    expect(maxJump).toBeLessThan(12);
  });
});

describe('time-determinism (replay guard)', () => {
  it('all C1 shapes ignore t', () => {
    const fields = [
      new CapsuleField({ x: 240, y: 360, halfLen: 80, angle: 0.5, radius: 40, dirX: 1, dirY: 0.2, strength: 90, falloff: 30 }),
      new RadialField({ x: 200, y: 300, radius: 100, strength: 70, falloff: 28 }),
      new WedgeField({ x: 240, y: 360, halfW: 100, halfH: 90, rampAxis: 'y', rampDir: -1, dirX: 1, dirY: 0, strength: 80, falloff: 26 }),
      new RingField({ x: 240, y: 360, radius: 90, band: 25, strength: 60, direction: -1 }),
      new GradientBandField({ x: 240, y: 360, halfW: 110, halfH: 95, strength: 100, falloff: 30 }),
    ];
    for (const f of fields) {
      for (const [x, y] of [[180, 320], [240, 360], [300, 420]] as const) {
        expect(f.sampleForce(x, y, 9.99)).toEqual(f.sampleForce(x, y, 0));
      }
    }
  });
});
