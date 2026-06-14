import type { FluidField, Vec2 } from '../FluidField';

/**
 * Superposition of child fields (ARCHITECTURE v3.3 §3.4): the sampled force is
 * the vector sum. Pure in (x, y, t) iff its children are.
 */
export class CompositeField implements FluidField {
  constructor(private readonly children: readonly FluidField[]) {}

  sampleForce(px: number, py: number, t: number): Vec2 {
    let x = 0;
    let y = 0;
    for (const c of this.children) {
      const f = c.sampleForce(px, py, t);
      x += f.x;
      y += f.y;
    }
    return { x, y };
  }
}
