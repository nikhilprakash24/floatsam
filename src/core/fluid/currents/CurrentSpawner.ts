import type { FluidField, Vec2 } from '../FluidField';
import { clamp } from '../fields/math';
import { type Rng, rngRange } from '../../rng';
import { type CellKind, buildCellField, cellHalfWidth } from './cells';

/**
 * A live current cell: a localized field placed at `worldX` (which scrolls left
 * with the world) and a fixed `centerY`. The field is built once in the cell's
 * local frame; the ScrollingCurrentField translates the sample point into that
 * frame. Mirrors the object-pooled, seeded discipline of GateSpawner so replay,
 * golden, and fairness all hold.
 */
export interface CurrentCell {
  kind: CellKind;
  worldX: number;
  centerY: number;
  halfWidth: number;
  field: FluidField;
}

export interface CurrentSpawnOptions {
  worldW: number;
  worldH: number;
  /** Distance (px) between successive cell centers along x. Lower = denser. */
  spacing: number;
  /** Master strength multiplier for every cell. */
  intensity: number;
  /** Kinds this spawner may draw from (seeded uniform pick). */
  kinds: readonly CellKind[];
  /** World-x of the first cell. */
  firstX: number;
  /** Keep cell centers within [marginY, worldH − marginY]. */
  marginY: number;
}

/**
 * Object-pooled, seeded current-cell generator. Cells scroll left; any that
 * pass off the left edge are recycled to the right with a fresh (seeded) kind
 * and center. Deterministic given (seed, options).
 */
export class CurrentSpawner {
  readonly cells: CurrentCell[] = [];

  constructor(
    private readonly opts: CurrentSpawnOptions,
    private readonly rng: Rng,
  ) {
    const pool = Math.ceil(opts.worldW / opts.spacing) + 2;
    for (let i = 0; i < pool; i++) this.cells.push(this.make(opts.firstX + i * opts.spacing));
  }

  private make(x: number): CurrentCell {
    const kinds = this.opts.kinds;
    const kind = kinds[Math.min(kinds.length - 1, Math.floor(rngRange(this.rng, 0, kinds.length)))]!;
    const centerY = rngRange(this.rng, this.opts.marginY, this.opts.worldH - this.opts.marginY);
    return {
      kind,
      worldX: x,
      centerY,
      halfWidth: cellHalfWidth(kind),
      field: buildCellField(kind, centerY, this.opts.intensity),
    };
  }

  /** Advance cells one step; recycle any that scrolled fully off the left edge. */
  update(dt: number, speed: number): void {
    let rightmost = -Infinity;
    for (const c of this.cells) {
      c.worldX -= speed * dt;
      if (c.worldX > rightmost) rightmost = c.worldX;
    }
    for (const c of this.cells) {
      if (c.worldX < -c.halfWidth - 40) {
        const nx = rightmost + this.opts.spacing;
        Object.assign(c, this.make(nx));
        rightmost = nx;
      }
    }
  }
}

/**
 * The FluidField the Simulation consumes: it maps the body into each live
 * cell's local frame (`localX = bodyX − cell.worldX`), sums their contributions,
 * and clamps the total to the §3.5 budgets. This is the single seam — no change
 * to FluidBody, and the clamp guarantees escapability no matter how the cells
 * stack.
 */
export class ScrollingCurrentField implements FluidField {
  constructor(
    private readonly spawner: CurrentSpawner,
    private readonly upMax: number,
    private readonly downMax: number,
    private readonly latMax: number,
  ) {}

  sampleForce(bodyX: number, bodyY: number, t: number): Vec2 {
    let fx = 0;
    let fy = 0;
    for (const c of this.spawner.cells) {
      // Cheap x-cull: outside the footprint the field is zero anyway.
      if (Math.abs(bodyX - c.worldX) > c.halfWidth) continue;
      const f = c.field.sampleForce(bodyX - c.worldX, bodyY, t);
      fx += f.x;
      fy += f.y;
    }
    return { x: clamp(fx, -this.latMax, this.latMax), y: clamp(fy, -this.upMax, this.downMax) };
  }
}
