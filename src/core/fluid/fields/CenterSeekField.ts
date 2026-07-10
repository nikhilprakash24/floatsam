import type { FluidField, Vec2 } from '../FluidField';
import { clamp } from './math';

/**
 * Vertical stabilizer: Fy = −k·(y − centerY), capped. The "assist" current —
 * it herds a drifting body toward a comfortable band. Negative difficulty
 * (an easing knob), the counterpart to turbulence.
 */
export class CenterSeekField implements FluidField {
  constructor(
    private readonly centerY: number,
    private readonly k: number,
    private readonly maxAccel: number,
  ) {}

  sampleForce(_x: number, y: number, _t: number): Vec2 {
    return { x: 0, y: clamp(-this.k * (y - this.centerY), -this.maxAccel, this.maxAccel) };
  }
}
