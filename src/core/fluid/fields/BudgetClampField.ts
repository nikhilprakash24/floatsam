import type { FluidField, Vec2 } from '../FluidField';
import { clamp } from './math';

/**
 * The safety governor: whatever the composed current stack requests, the
 * emitted force never exceeds the §3.5 budgets (anchored to the weakest
 * creature's thrust). This is what lets the knob set include values past 1.0 —
 * you can crank intensity experimentally and the output stays escapable.
 */
export class BudgetClampField implements FluidField {
  constructor(
    private readonly child: FluidField,
    private readonly upMax: number,
    private readonly downMax: number,
    private readonly latMax: number,
  ) {}

  sampleForce(x: number, y: number, t: number): Vec2 {
    const f = this.child.sampleForce(x, y, t);
    return {
      x: clamp(f.x, -this.latMax, this.latMax),
      y: clamp(f.y, -this.upMax, this.downMax),
    };
  }
}
