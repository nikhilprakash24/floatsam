import type { FluidField, Vec2 } from '../FluidField';

/**
 * Gates a child field with a smooth time pulse: factor = (0.5+0.5·sin(2πt/T))^sharp.
 * Pure in t (sim time only) → replay-deterministic. Thermal vents breathe with
 * this; `periodSec` is a difficulty knob (shorter = harder to time).
 */
export class PulsingField implements FluidField {
  constructor(
    private readonly child: FluidField,
    private readonly periodSec: number,
    private readonly sharpness = 2,
    private readonly floor = 0,
  ) {}

  sampleForce(x: number, y: number, t: number): Vec2 {
    const raw = 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / this.periodSec);
    const k = this.floor + (1 - this.floor) * Math.pow(raw, this.sharpness);
    const f = this.child.sampleForce(x, y, t);
    return { x: f.x * k, y: f.y * k };
  }
}
