import type { FluidField, Vec2 } from '../FluidField';
import { smoothstep } from './math';

/**
 * A shear cell: horizontal flow that reverses across the band's height — the
 * top half pushes one way, the bottom half the other, with a smooth zero-cross
 * on the mid-line. Crossing the seam means fighting a flip in your tailwind.
 * Confined to a rect region with smoothstep edges. Pure in (x, y, t).
 *
 * `Fx = strength · smoothstep-ramp(−1 → +1 across height)`, gated by the rect
 * mask. Set `strength` sign to pick which half is the tailwind.
 */
export interface GradientBandFieldConfig {
  /** Center of the rect region. */
  x: number;
  y: number;
  halfW: number;
  halfH: number;
  /** Peak horizontal acceleration at the band's edges (px/s²). */
  strength: number;
  /** Edge falloff band width (px); clamped to ≥ 24. */
  falloff: number;
}

export class GradientBandField implements FluidField {
  private readonly band: number;

  constructor(private readonly cfg: GradientBandFieldConfig) {
    this.band = Math.max(24, cfg.falloff);
  }

  sampleForce(px: number, py: number, _t: number): Vec2 {
    const c = this.cfg;
    const dx = Math.min(px - (c.x - c.halfW), c.x + c.halfW - px);
    const dy = Math.min(py - (c.y - c.halfH), c.y + c.halfH - py);
    const edge = Math.min(dx, dy);
    if (edge <= 0) return { x: 0, y: 0 };
    // Depth fraction −1 (top) → +1 (bottom), smoothed so the flip is a gradient.
    const frac = (py - c.y) / c.halfH; // −1..1
    const shear = 2 * smoothstep(-1, 1, frac) - 1; // −1..1, smooth zero-cross
    const mask = smoothstep(0, this.band, edge);
    return { x: c.strength * shear * mask, y: 0 };
  }
}
