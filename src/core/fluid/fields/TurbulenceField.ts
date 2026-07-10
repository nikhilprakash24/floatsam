import type { FluidField, Vec2 } from '../FluidField';
import { smoothstep } from './math';

/** Deterministic per-cell hash → angle in [0, 2π). No Math.random, no state. */
function cellAngle(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967296) * Math.PI * 2;
}

/**
 * Value-noise turbulence: each grid cell corner owns a deterministic unit
 * vector; samples smoothstep-interpolate between corners, so the field is
 * chaotic at range but locally smooth (no force cliffs). `strength` is the
 * difficulty-texture knob. Pure in (x, y) — time-invariant, replay-safe.
 */
export class TurbulenceField implements FluidField {
  constructor(
    private readonly strength: number,
    private readonly cellSize = 96,
    private readonly seed = 7,
  ) {}

  sampleForce(x: number, y: number, _t: number): Vec2 {
    const cx = x / this.cellSize;
    const cy = y / this.cellSize;
    const ix = Math.floor(cx);
    const iy = Math.floor(cy);
    const fx = smoothstep(0, 1, cx - ix);
    const fy = smoothstep(0, 1, cy - iy);

    let vx = 0;
    let vy = 0;
    for (const [dx, dy, wx, wy] of [
      [0, 0, 1 - fx, 1 - fy],
      [1, 0, fx, 1 - fy],
      [0, 1, 1 - fx, fy],
      [1, 1, fx, fy],
    ] as const) {
      const a = cellAngle(ix + dx, iy + dy, this.seed);
      const w = wx * wy;
      vx += Math.cos(a) * w;
      vy += Math.sin(a) * w;
    }
    return { x: vx * this.strength, y: vy * this.strength };
  }
}
