import type { FluidPhysicsConfig, Thrust } from '../fluid/FluidBody';
import type { InputPolicy } from './InputPolicy';

/**
 * Classic input: a tap tops up an upward-impulse reservoir to `swimImpulse`,
 * which then drains over `swimBlendSteps` fixed steps as a direct upward Δv —
 * momentum carries, velocity is never set (ARCHITECTURE §4.1). This is the
 * shipped behavior, lifted out of Simulation/FluidBody unchanged: per step the
 * drained slice equals the old `swimDv`, applied as thrust (0, −swimDv).
 */
export class TapUpPolicy implements InputPolicy {
  private pending = 0;
  private queued = false;

  constructor(private readonly cfg: Pick<FluidPhysicsConfig, 'swimImpulse' | 'swimBlendSteps'>) {}

  press(): void {
    this.queued = true;
  }

  setHold(_up: boolean, _down: boolean): void {
    /* tap-based policy ignores held input */
  }

  step(_dt: number): Thrust {
    if (this.queued) {
      // Re-tapping tops up rather than stacking unboundedly.
      this.pending = Math.max(this.pending, this.cfg.swimImpulse);
      this.queued = false;
    }
    const swimDv = Math.min(this.pending, this.cfg.swimImpulse / this.cfg.swimBlendSteps);
    this.pending -= swimDv;
    return { dvx: 0, dvy: -swimDv };
  }

  reservoir(): number {
    return this.pending;
  }

  reset(): void {
    this.pending = 0;
    this.queued = false;
  }
}
