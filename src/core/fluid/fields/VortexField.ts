import type { FluidField, Vec2 } from '../FluidField';

/**
 * A swirling current (ARCHITECTURE v3.3 §3.4): solid-body rotation inside
 * radius R (tangential speed ∝ r/R), smooth 1/r decay outside, an optional
 * small radial inflow, and a hard magnitude cap. Pure in (x, y, t).
 */
export interface VortexFieldConfig {
  x: number;
  y: number;
  /** Core radius (px). */
  radius: number;
  /** Peak tangential acceleration at the rim (px/s²). */
  strength: number;
  /** +1 counter-clockwise, −1 clockwise. */
  direction: 1 | -1;
  /** Inward pull acceleration (px/s²); 0 = pure swirl. */
  inflow?: number;
  /** Magnitude cap (px/s²). */
  maxAccel: number;
}

export class VortexField implements FluidField {
  constructor(private readonly cfg: VortexFieldConfig) {}

  sampleForce(px: number, py: number, _t: number): Vec2 {
    const c = this.cfg;
    const rx = px - c.x;
    const ry = py - c.y;
    const dist = Math.hypot(rx, ry) || 1e-6;

    // Tangential speed: solid-body inside the core, 1/r decay outside (equal at R).
    const speed = dist <= c.radius ? c.strength * (dist / c.radius) : c.strength * (c.radius / dist);

    // Tangential unit vector (perpendicular to radius), oriented by direction.
    const tx = (-ry / dist) * c.direction;
    const ty = (rx / dist) * c.direction;

    const inflow = c.inflow ?? 0;
    let fx = tx * speed - (rx / dist) * inflow;
    let fy = ty * speed - (ry / dist) * inflow;

    const mag = Math.hypot(fx, fy);
    if (mag > c.maxAccel) {
      const k = c.maxAccel / mag;
      fx *= k;
      fy *= k;
    }
    return { x: fx, y: fy };
  }
}
