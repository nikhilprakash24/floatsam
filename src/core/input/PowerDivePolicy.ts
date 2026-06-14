import type { Thrust } from '../fluid/FluidBody';
import type { InputPolicy } from './InputPolicy';
import type { BiAxialConfig } from './BiAxialPolicy';

export interface PowerDiveConfig extends BiAxialConfig {
  /** Forward (+x) thrust accel added while diving — already character-scaled. */
  thrustForward: number;
}

function approach(cur: number, target: number, full: number, timeSec: number, dt: number): number {
  if (timeSec <= 0) return target;
  const rate = full / timeSec;
  if (cur < target) return Math.min(target, cur + rate * dt);
  return Math.max(target, cur - rate * dt);
}

/**
 * Power Dive input: like BiAxial up/down, but a dive (down) ALSO drives a
 * forward (+x) lunge — you surge down and ahead. Rising is pure up. The forward
 * thrust ramps with the dive and is scaled per character (a heavier, more
 * powerful creature lunges further), so the same input feels different across
 * the roster. All thrust stays a small per-step Δv → momentum carries.
 */
export class PowerDivePolicy implements InputPolicy {
  private up = false;
  private down = false;
  private aUp = 0;
  private aDown = 0;
  private aFwd = 0;

  constructor(private readonly cfg: PowerDiveConfig) {}

  press(): void {
    /* hold-based */
  }

  setHold(up: boolean, down: boolean): void {
    this.up = up && !down;
    this.down = down && !up;
  }

  step(dt: number): Thrust {
    const attack = this.cfg.attackMs / 1000;
    const decay = this.cfg.decayMs / 1000;
    this.aUp = approach(this.aUp, this.up ? this.cfg.thrustUp : 0, this.cfg.thrustUp, this.up ? attack : decay, dt);
    this.aDown = approach(this.aDown, this.down ? this.cfg.thrustDown : 0, this.cfg.thrustDown, this.down ? attack : decay, dt);
    this.aFwd = approach(this.aFwd, this.down ? this.cfg.thrustForward : 0, this.cfg.thrustForward, this.down ? attack : decay, dt);
    return { dvx: this.aFwd * dt, dvy: (this.aDown - this.aUp) * dt };
  }

  reservoir(): number {
    return 0;
  }

  reset(): void {
    this.up = false;
    this.down = false;
    this.aUp = 0;
    this.aDown = 0;
    this.aFwd = 0;
  }
}
