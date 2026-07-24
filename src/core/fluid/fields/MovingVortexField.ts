import type { FluidField, Vec2 } from '../FluidField';

/**
 * A vortex core that drifts across the column on a fixed circuit — a swirl that
 * wanders into and out of your path. Pure in t (center is a deterministic
 * function of time), so replay-safe. Same solid-body-inside / 1/r-outside
 * profile as VortexField, with a hard magnitude cap.
 */
export class MovingVortexField implements FluidField {
  constructor(
    private readonly radius: number,
    private readonly strength: number,
    private readonly direction: 1 | -1,
    private readonly maxAccel: number,
    private readonly speed = 70,
    private readonly worldW = 480,
    private readonly worldH = 720,
    private readonly bobAmp = 120,
  ) {}

  sampleForce(px: number, py: number, t: number): Vec2 {
    const span = this.worldW + this.radius * 2;
    const cx = ((t * this.speed) % span) - this.radius;
    const cy = this.worldH / 2 + Math.sin(t * 0.6) * this.bobAmp;
    const rx = px - cx;
    const ry = py - cy;
    const dist = Math.hypot(rx, ry) || 1e-6;
    const speed = dist <= this.radius ? this.strength * (dist / this.radius) : this.strength * (this.radius / dist);
    let fx = (-ry / dist) * this.direction * speed;
    let fy = (rx / dist) * this.direction * speed;
    const mag = Math.hypot(fx, fy);
    if (mag > this.maxAccel) {
      const k = this.maxAccel / mag;
      fx *= k;
      fy *= k;
    }
    return { x: fx, y: fy };
  }
}
