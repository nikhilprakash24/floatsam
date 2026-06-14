import type { FluidField, Vec2 } from '../FluidField';

/**
 * A horizontal restoring spring toward `homeX` (used by Power Dive, §Power-Dive
 * mode): `Fx = −k·(x − homeX)`. Lets the player lunge forward on a dive and
 * drift back to a home column at rest. Position-dependent but time-independent,
 * so it stays replay-deterministic. Pure in (x, y, t).
 */
export interface HomeSpringConfig {
  homeX: number;
  /** Stiffness (accel per px of displacement). */
  k: number;
}

export class HomeSpringField implements FluidField {
  constructor(private readonly cfg: HomeSpringConfig) {}

  sampleForce(px: number, _py: number, _t: number): Vec2 {
    return { x: -this.cfg.k * (px - this.cfg.homeX), y: 0 };
  }
}
