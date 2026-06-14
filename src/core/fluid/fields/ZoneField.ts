import type { FluidField, Vec2 } from '../FluidField';
import { smoothstep } from './math';

/**
 * A directional current confined to a rectangular or circular volume
 * (ARCHITECTURE v3.3 §3.4). Full strength in the interior, ramping to zero over
 * a smoothstep edge band ≥ 24 px so there are no force cliffs. Pure in (x, y, t).
 */
export interface ZoneFieldConfig {
  shape: 'rect' | 'circle';
  /** Center. */
  x: number;
  y: number;
  /** Rect half-extents (ignored for circle). */
  halfW?: number;
  halfH?: number;
  /** Circle radius (ignored for rect). */
  radius?: number;
  /** Flow direction (need not be normalized; it is normalized internally). */
  dirX: number;
  dirY: number;
  /** Peak acceleration (px/s²). */
  strength: number;
  /** Edge falloff band width (px); clamped to ≥ 24. */
  falloff: number;
}

export class ZoneField implements FluidField {
  private readonly nx: number;
  private readonly ny: number;
  private readonly band: number;

  constructor(private readonly cfg: ZoneFieldConfig) {
    const len = Math.hypot(cfg.dirX, cfg.dirY) || 1;
    this.nx = cfg.dirX / len;
    this.ny = cfg.dirY / len;
    this.band = Math.max(24, cfg.falloff);
  }

  /** 1 deep inside, smooth ramp near the edge, 0 outside. */
  private intensity(px: number, py: number): number {
    const c = this.cfg;
    if (c.shape === 'circle') {
      const inside = (c.radius ?? 0) - Math.hypot(px - c.x, py - c.y);
      return inside <= 0 ? 0 : smoothstep(0, this.band, inside);
    }
    const dx = Math.min(px - (c.x - (c.halfW ?? 0)), c.x + (c.halfW ?? 0) - px);
    const dy = Math.min(py - (c.y - (c.halfH ?? 0)), c.y + (c.halfH ?? 0) - py);
    const d = Math.min(dx, dy);
    return d <= 0 ? 0 : smoothstep(0, this.band, d);
  }

  sampleForce(px: number, py: number, _t: number): Vec2 {
    const f = this.intensity(px, py) * this.cfg.strength;
    return { x: this.nx * f, y: this.ny * f };
  }
}
