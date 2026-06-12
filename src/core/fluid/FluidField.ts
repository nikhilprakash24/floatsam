export interface Vec2 {
  x: number;
  y: number;
}

/**
 * The future-proofing seam (ARCHITECTURE.md §4.3).
 * Classic mode returns a constant; Normal mode later swaps in a vector field
 * (currents/vortices) without touching FluidBody or Player.
 */
export interface FluidField {
  /** Acceleration contributed by the water at (x, y) at time t, px/s². */
  sampleForce(x: number, y: number, t: number): Vec2;
}

/** Classic mode: constant net buoyancy, everywhere, always. */
export class ConstantBuoyancyField implements FluidField {
  private readonly force: Vec2;

  constructor(buoyancyAccel: number) {
    // Screen-down is +y, so buoyancy points -y.
    this.force = { x: 0, y: -buoyancyAccel };
  }

  sampleForce(_x: number, _y: number, _t: number): Vec2 {
    return this.force;
  }
}
