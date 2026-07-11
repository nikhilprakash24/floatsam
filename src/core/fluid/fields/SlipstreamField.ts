import type { FluidField, Vec2 } from '../FluidField';
import { smoothstep } from './math';

/**
 * A tailwind pocket that travels the column on a fixed circuit — a moving
 * bubble of forward push you can chase and catch. Pure in t (the center is a
 * deterministic function of time), so replay-safe. Extracted from the Fable
 * presets so the catalog and the game can share it.
 */
export class SlipstreamField implements FluidField {
  constructor(
    private readonly strength: number,
    private readonly radius = 120,
    private readonly speed = 90,
    private readonly worldW = 480,
    private readonly worldH = 720,
  ) {}

  sampleForce(x: number, y: number, t: number): Vec2 {
    const span = this.worldW + this.radius * 2;
    const cx = ((t * this.speed) % span) - this.radius;
    const cy = this.worldH / 2 + Math.sin(t * 0.7) * 160;
    const d = Math.hypot(x - cx, y - cy);
    const k = d >= this.radius ? 0 : smoothstep(0, this.radius * 0.7, this.radius - d);
    return { x: this.strength * k, y: 0 };
  }
}
