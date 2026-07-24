import type { FluidField, Vec2 } from '../FluidField';
import { smoothstep } from './math';

/**
 * A tangential current confined to an annulus — a spinning "wall" at radius R,
 * fading to zero on either side of the ring band. Reads as a whirlpool rim you
 * thread rather than a solid vortex core (that's VortexField). Direction ±1
 * sets spin; magnitude peaks on the ring and smoothsteps off across `band`.
 * Pure in (x, y, t).
 */
export interface RingFieldConfig {
  x: number;
  y: number;
  /** Ring radius (px) — where the flow peaks. */
  radius: number;
  /** Half-width of the flowing band around the ring (px). */
  band: number;
  /** Peak tangential acceleration (px/s²). */
  strength: number;
  /** +1 counter-clockwise, −1 clockwise. */
  direction: 1 | -1;
}

export class RingField implements FluidField {
  constructor(private readonly cfg: RingFieldConfig) {}

  sampleForce(px: number, py: number, _t: number): Vec2 {
    const c = this.cfg;
    const rx = px - c.x;
    const ry = py - c.y;
    const dist = Math.hypot(rx, ry) || 1e-6;
    // Peak on the ring, ramping to 0 at radius ± band (smoothstep both sides).
    const off = Math.abs(dist - c.radius);
    if (off >= c.band) return { x: 0, y: 0 };
    const k = smoothstep(0, c.band, c.band - off);
    const speed = c.strength * k;
    // Tangential unit vector, oriented by spin direction.
    const tx = (-ry / dist) * c.direction;
    const ty = (rx / dist) * c.direction;
    return { x: tx * speed, y: ty * speed };
  }
}
