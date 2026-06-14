import type { Thrust } from '../fluid/FluidBody';
import type { InputPolicy } from './InputPolicy';

export interface BiAxialConfig {
  /** Upward thrust acceleration at full hold (px/s²), already character-scaled. */
  thrustUp: number;
  /** Downward thrust acceleration at full hold (px/s²), already character-scaled. */
  thrustDown: number;
  /** Time to ramp a held axis from 0 to full thrust (ease-in feel). */
  attackMs: number;
  /** Time to ramp an axis back to 0 after release. */
  decayMs: number;
}

/** Move `cur` toward `target` at `full/timeSec` per second, without overshooting. */
function approach(cur: number, target: number, full: number, timeSec: number, dt: number): number {
  if (timeSec <= 0) return target;
  const rate = full / timeSec;
  if (cur < target) return Math.min(target, cur + rate * dt);
  return Math.max(target, cur - rate * dt);
}

/**
 * Dive & Currents-Lab input (ARCHITECTURE v3.3 §3.3): hold upper half →
 * upward thrust, lower half → downward thrust (dive). Each axis ramps in over
 * `attackMs` and decays over `decayMs`; thrust is a sustained ACCELERATION, so
 * the contributed Δv = accel·dt is always small and velocity never snaps —
 * momentum carries, and a reversal produces a visible ~momentum-fight. Because
 * descents are the scarce resource underwater (§3.5), `thrustDown` is the
 * headline force.
 */
export class BiAxialPolicy implements InputPolicy {
  private up = false;
  private down = false;
  private aUp = 0;
  private aDown = 0;

  constructor(private readonly cfg: BiAxialConfig) {}

  press(): void {
    /* hold-based policy ignores discrete presses */
  }

  setHold(up: boolean, down: boolean): void {
    // Opposing holds cancel rather than fighting (e.g. straddling mid-screen).
    this.up = up && !down;
    this.down = down && !up;
  }

  step(dt: number): Thrust {
    const attack = this.cfg.attackMs / 1000;
    const decay = this.cfg.decayMs / 1000;
    const upTarget = this.up ? this.cfg.thrustUp : 0;
    const downTarget = this.down ? this.cfg.thrustDown : 0;
    this.aUp = approach(this.aUp, upTarget, this.cfg.thrustUp, this.up ? attack : decay, dt);
    this.aDown = approach(this.aDown, downTarget, this.cfg.thrustDown, this.down ? attack : decay, dt);
    // Screen-down is +y: down thrust is +, up thrust is −.
    return { dvx: 0, dvy: (this.aDown - this.aUp) * dt };
  }

  reservoir(): number {
    return 0;
  }

  reset(): void {
    this.up = false;
    this.down = false;
    this.aUp = 0;
    this.aDown = 0;
  }
}
