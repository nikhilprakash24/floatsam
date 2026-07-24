import type { FluidField, Vec2 } from '../FluidField';
import { TurbulenceField } from '../fields/TurbulenceField';
import { type Rng, rngRange } from '../../rng';

/**
 * SURGE (currents program C5) — the rare whole-screen event. Most of the time
 * the ocean is calm (ramp 0); every everySec[Min..Max] a storm ramps in over
 * `rampSec`, heaves the entire column for `holdSec`, then ramps out. It's the
 * punctuation to the cells' grammar (§0): dramatic, brief, and — because it
 * flows through the same budget clamp as the cells — always escapable.
 *
 * Deterministic: the schedule is driven by a seeded Rng and advanced by fixed
 * dt, so replays and the golden discipline hold.
 */
export interface SurgeConfig {
  everySecMin: number;
  everySecMax: number;
  holdSec: number;
  rampSec: number;
  intensity: number;
  lethal: boolean;
}

type Phase = 'idle' | 'ramp-in' | 'hold' | 'ramp-out';

export class SurgeScheduler {
  /** Current envelope in [0,1]: 0 calm, 1 full storm. */
  ramp = 0;
  private phase: Phase = 'idle';
  private timer: number;

  constructor(
    private readonly cfg: SurgeConfig,
    private readonly rng: Rng,
  ) {
    this.timer = rngRange(rng, cfg.everySecMin, cfg.everySecMax);
  }

  /** True while a surge is ramping or held (for cues/telegraph). */
  get active(): boolean {
    return this.phase !== 'idle';
  }

  /** Advance the schedule by dt seconds; returns the new ramp factor. */
  update(dt: number): number {
    this.timer -= dt;
    switch (this.phase) {
      case 'idle':
        this.ramp = 0;
        if (this.timer <= 0) {
          this.phase = 'ramp-in';
          this.timer = this.cfg.rampSec;
        }
        break;
      case 'ramp-in':
        this.ramp = this.cfg.rampSec > 0 ? 1 - Math.max(0, this.timer) / this.cfg.rampSec : 1;
        if (this.timer <= 0) {
          this.phase = 'hold';
          this.timer = this.cfg.holdSec;
          this.ramp = 1;
        }
        break;
      case 'hold':
        this.ramp = 1;
        if (this.timer <= 0) {
          this.phase = 'ramp-out';
          this.timer = this.cfg.rampSec;
        }
        break;
      case 'ramp-out':
        this.ramp = this.cfg.rampSec > 0 ? Math.max(0, this.timer) / this.cfg.rampSec : 0;
        if (this.timer <= 0) {
          this.phase = 'idle';
          this.timer = rngRange(this.rng, this.cfg.everySecMin, this.cfg.everySecMax);
          this.ramp = 0;
        }
        break;
    }
    return this.ramp;
  }
}

/**
 * The whole-screen field a surge applies: value-noise turbulence plus a gentle
 * downward drift, the whole thing scaled by the scheduler's ramp × intensity.
 * Zero cost and zero force when the ramp is 0 (the common case). Pass this as
 * the ScrollingCurrentField's `extra` so it shares the cells' single budget
 * clamp — cells + surge can never jointly exceed the escape budget.
 */
export class SurgeField implements FluidField {
  private readonly turb: TurbulenceField;

  constructor(
    private readonly scheduler: SurgeScheduler,
    private readonly intensity: number,
    private readonly driftY = 90,
  ) {
    this.turb = new TurbulenceField(140, 120, 41);
  }

  sampleForce(x: number, y: number, t: number): Vec2 {
    const k = this.scheduler.ramp * this.intensity;
    if (k <= 0) return { x: 0, y: 0 };
    const f = this.turb.sampleForce(x, y, t);
    return { x: f.x * k, y: (f.y + this.driftY) * k };
  }
}
