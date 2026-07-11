import type { FluidField, Vec2 } from '../FluidField';
import { smoothstep } from './math';

/**
 * A directional current confined to a capsule (a line segment thickened by a
 * radius) — i.e. a *finite* lane with rounded ends, so it can be a localized
 * cell rather than a full-width band. Full strength on the axis, smoothstep
 * ramp to zero over the last `falloff` px of thickness. Pure in (x, y, t).
 *
 * The segment runs `halfLen` px either side of (x, y) along `angle` (radians,
 * 0 = +x); flow points along `dir` (need not be normalized). Set `dir` along
 * the axis for a lane, across it for a cross-jet.
 */
export interface CapsuleFieldConfig {
  /** Center of the segment. */
  x: number;
  y: number;
  /** Half-length of the segment (px). */
  halfLen: number;
  /** Axis orientation (radians; 0 = horizontal). */
  angle: number;
  /** Half-thickness (px) — the capsule radius. */
  radius: number;
  /** Flow direction (normalized internally). */
  dirX: number;
  dirY: number;
  /** Peak acceleration (px/s²). */
  strength: number;
  /** Edge falloff band width (px); clamped to ≥ 24. */
  falloff: number;
}

export class CapsuleField implements FluidField {
  private readonly ax: number;
  private readonly ay: number;
  private readonly nx: number;
  private readonly ny: number;
  private readonly band: number;

  constructor(private readonly cfg: CapsuleFieldConfig) {
    this.ax = Math.cos(cfg.angle);
    this.ay = Math.sin(cfg.angle);
    const len = Math.hypot(cfg.dirX, cfg.dirY) || 1;
    this.nx = cfg.dirX / len;
    this.ny = cfg.dirY / len;
    this.band = Math.max(24, cfg.falloff);
  }

  sampleForce(px: number, py: number, _t: number): Vec2 {
    const c = this.cfg;
    // Project the point onto the segment axis, clamped to its length.
    const rx = px - c.x;
    const ry = py - c.y;
    let proj = rx * this.ax + ry * this.ay;
    if (proj > c.halfLen) proj = c.halfLen;
    else if (proj < -c.halfLen) proj = -c.halfLen;
    // Distance from the point to that nearest segment point.
    const dx = rx - proj * this.ax;
    const dy = ry - proj * this.ay;
    const dist = Math.hypot(dx, dy);
    const inside = c.radius - dist;
    if (inside <= 0) return { x: 0, y: 0 };
    const f = smoothstep(0, this.band, inside) * c.strength;
    return { x: this.nx * f, y: this.ny * f };
  }
}
