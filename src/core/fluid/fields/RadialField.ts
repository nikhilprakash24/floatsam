import type { FluidField, Vec2 } from '../FluidField';
import { smoothstep } from './math';

/**
 * A pure radial current inside a circle: a *source* (strength > 0, pushes
 * outward — a "boil") or a *sink* (strength < 0, pulls inward — a "drain").
 * Unlike VortexField this has no swirl; unlike ZoneField the direction points
 * away from / toward the center at every point. Smoothstep edge, hard cap.
 * Pure in (x, y, t).
 */
export interface RadialFieldConfig {
  x: number;
  y: number;
  /** Region radius (px). */
  radius: number;
  /** Peak acceleration (px/s²); + = outward source, − = inward sink. */
  strength: number;
  /** Edge falloff band width (px); clamped to ≥ 24. */
  falloff: number;
  /** Magnitude cap (px/s²); defaults to |strength|. */
  maxAccel?: number;
}

export class RadialField implements FluidField {
  private readonly band: number;
  private readonly cap: number;

  constructor(private readonly cfg: RadialFieldConfig) {
    this.band = Math.max(24, cfg.falloff);
    this.cap = cfg.maxAccel ?? Math.abs(cfg.strength);
  }

  sampleForce(px: number, py: number, _t: number): Vec2 {
    const c = this.cfg;
    const rx = px - c.x;
    const ry = py - c.y;
    const dist = Math.hypot(rx, ry);
    const inside = c.radius - dist;
    if (inside <= 0 || dist < 1e-6) return { x: 0, y: 0 };
    let mag = smoothstep(0, this.band, inside) * c.strength;
    if (mag > this.cap) mag = this.cap;
    else if (mag < -this.cap) mag = -this.cap;
    return { x: (rx / dist) * mag, y: (ry / dist) * mag };
  }
}
