import type { FluidField, Vec2 } from '../FluidField';

/**
 * Horizontal current lanes alternating direction with depth:
 * Fx = strength · sin(π·y / laneHeight). Smooth by construction (sine), so
 * crossing a lane boundary is a gradient, not a cliff. In free-x modes this
 * makes vertical position choose your headwind/tailwind — a positioning
 * difficulty knob that Power Dive's lunge can exploit or fight.
 */
export class LaneField implements FluidField {
  constructor(
    private readonly strength: number,
    private readonly laneHeight = 180,
    private readonly phase = 0,
  ) {}

  sampleForce(_x: number, y: number, _t: number): Vec2 {
    return { x: this.strength * Math.sin((Math.PI * y) / this.laneHeight + this.phase), y: 0 };
  }
}
