import type { FluidField, Vec2 } from '../FluidField';
import { smoothstep } from './math';

/**
 * A directional current inside an axis-aligned rectangle whose strength *ramps*
 * from 0 to full along one axis — a launch ramp of lift (or a building
 * headwind). The cross-axis uses a smoothstep edge (no cliff); the ramp axis
 * grows linearly (`rampDir` +1 → strongest at the +axis end). Pure in (x,y,t).
 */
export interface WedgeFieldConfig {
  /** Center of the rectangle. */
  x: number;
  y: number;
  halfW: number;
  halfH: number;
  /** Which axis the strength ramps along. */
  rampAxis: 'x' | 'y';
  /** +1 = strongest toward the +axis end, −1 = toward the −axis end. */
  rampDir: 1 | -1;
  /** Flow direction (normalized internally). */
  dirX: number;
  dirY: number;
  /** Peak acceleration at the strong end (px/s²). */
  strength: number;
  /** Cross-edge falloff band width (px); clamped to ≥ 24. */
  falloff: number;
}

export class WedgeField implements FluidField {
  private readonly nx: number;
  private readonly ny: number;
  private readonly band: number;

  constructor(private readonly cfg: WedgeFieldConfig) {
    const len = Math.hypot(cfg.dirX, cfg.dirY) || 1;
    this.nx = cfg.dirX / len;
    this.ny = cfg.dirY / len;
    this.band = Math.max(24, cfg.falloff);
  }

  sampleForce(px: number, py: number, _t: number): Vec2 {
    const c = this.cfg;
    const dx = Math.min(px - (c.x - c.halfW), c.x + c.halfW - px);
    const dy = Math.min(py - (c.y - c.halfH), c.y + c.halfH - py);
    const edge = Math.min(dx, dy);
    if (edge <= 0) return { x: 0, y: 0 };
    // Linear ramp fraction along the chosen axis, oriented by rampDir.
    const along = c.rampAxis === 'x' ? (px - c.x) / c.halfW : (py - c.y) / c.halfH;
    const frac = (1 + c.rampDir * along) / 2; // 0 at the weak end, 1 at the strong end
    const f = smoothstep(0, this.band, edge) * frac * c.strength;
    return { x: this.nx * f, y: this.ny * f };
  }
}
