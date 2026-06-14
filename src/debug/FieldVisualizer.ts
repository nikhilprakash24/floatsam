import Phaser from 'phaser';
import type { FluidField } from '../core/fluid/FluidField';

interface Particle {
  x: number;
  y: number;
  life: number;
}

/**
 * Renders a FluidField so you can *see* the flow (ARCHITECTURE v3.3 §3.6):
 * a static grid of direction arrows (length/colour ∝ magnitude) plus advected
 * tracer particles streaming along the field. Particles move by `field · dt`,
 * fade, and re-seed — a live visualization of the vector field.
 */
export class FieldVisualizer {
  private arrows: Phaser.GameObjects.Graphics;
  private flow: Phaser.GameObjects.Graphics;
  private particles: Particle[] = [];
  private rng = 1;

  constructor(
    scene: Phaser.Scene,
    private field: FluidField,
    private readonly w: number,
    private readonly h: number,
    count = 140,
  ) {
    this.arrows = scene.add.graphics().setDepth(2);
    this.flow = scene.add.graphics().setDepth(3);
    for (let i = 0; i < count; i++) this.particles.push(this.seed());
    this.drawArrows();
  }

  /** Deterministic pseudo-random in [0,1) — visualization only, no sim impact. */
  private rand(): number {
    this.rng = (this.rng * 1103515245 + 12345) & 0x7fffffff;
    return this.rng / 0x7fffffff;
  }

  private seed(): Particle {
    return { x: this.rand() * this.w, y: this.rand() * this.h, life: 0.5 + this.rand() * 2.5 };
  }

  setField(field: FluidField): void {
    this.field = field;
    this.drawArrows();
  }

  private drawArrows(): void {
    const g = this.arrows;
    g.clear();
    const step = 52;
    for (let x = step / 2; x < this.w; x += step) {
      for (let y = step / 2; y < this.h; y += step) {
        const f = this.field.sampleForce(x, y, 0);
        const mag = Math.hypot(f.x, f.y);
        if (mag < 1) continue;
        const len = Math.min(22, 6 + mag * 0.08);
        const ux = f.x / mag;
        const uy = f.y / mag;
        const tint = mag > 130 ? 0xff8a6b : mag > 70 ? 0x7fd0e0 : 0x4a8fa6;
        g.lineStyle(2, tint, 0.5);
        const x2 = x + ux * len;
        const y2 = y + uy * len;
        g.lineBetween(x, y, x2, y2);
        // Arrowhead.
        g.lineBetween(x2, y2, x2 - ux * 5 - uy * 4, y2 - uy * 5 + ux * 4);
        g.lineBetween(x2, y2, x2 - ux * 5 + uy * 4, y2 - uy * 5 - ux * 4);
      }
    }
  }

  /** Advect and redraw tracer particles. dt in seconds. */
  update(dt: number): void {
    const g = this.flow;
    g.clear();
    for (const p of this.particles) {
      const f = this.field.sampleForce(p.x, p.y, 0);
      const nx = p.x + f.x * dt * 0.5;
      const ny = p.y + f.y * dt * 0.5;
      p.life -= dt;
      const out = nx < 0 || nx > this.w || ny < 0 || ny > this.h;
      g.lineStyle(2, 0xbfe9f2, Math.min(0.7, p.life * 0.4));
      g.lineBetween(p.x, p.y, nx, ny);
      p.x = nx;
      p.y = ny;
      if (out || p.life <= 0) Object.assign(p, this.seed());
    }
  }

  destroy(): void {
    this.arrows.destroy();
    this.flow.destroy();
  }
}
