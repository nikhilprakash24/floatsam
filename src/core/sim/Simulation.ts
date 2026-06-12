import {
  applySwimImpulse,
  createBody,
  stepBody,
  type FluidBodyState,
  type FluidPhysicsConfig,
} from '../fluid/FluidBody';
import { ConstantBuoyancyField, type FluidField } from '../fluid/FluidField';
import { GateSpawner, type DifficultyConfig, type Gate } from '../spawn/Spawner';
import { collectPassedGates } from '../score/score';
import { createRng } from '../rng';

export interface PhysicsConfigFull extends FluidPhysicsConfig {
  rotationLerp: number;
  maxTiltDeg: number;
  playerHitboxScale: number;
}

export type SimPhase = 'PLAY' | 'DEAD' | 'OVER';

export interface SimEvents {
  onScore?: (score: number) => void;
  onDeath?: () => void;
  onGameOver?: () => void;
}

/** Circle vs axis-aligned rect overlap. */
export function circleRectOverlap(
  cx: number,
  cy: number,
  r: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): boolean {
  const nx = Math.max(rx, Math.min(cx, rx + rw));
  const ny = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

/**
 * The whole game, headless. Fixed 1/60 s steps behind an accumulator;
 * rendering interpolates between prev and current states. Identical seed +
 * identical tap frames ⇒ identical run (ARCHITECTURE.md §3 rule 3).
 */
export class Simulation {
  body: FluidBodyState;
  prevBody: FluidBodyState;
  readonly spawner: GateSpawner;
  score = 0;
  phase: SimPhase = 'PLAY';
  /** Sim time, seconds, advances only with fixed steps. */
  time = 0;
  frame = 0;

  private accumulator = 0;
  private tapQueued = false;
  private deadTimerMs = 0;
  private readonly field: FluidField;
  readonly hitboxRadius: number;

  constructor(
    readonly physics: PhysicsConfigFull,
    readonly difficulty: DifficultyConfig,
    seed: number,
    private readonly events: SimEvents = {},
  ) {
    this.field = new ConstantBuoyancyField(physics.buoyancyAccel);
    this.spawner = new GateSpawner(difficulty, createRng(seed));
    this.body = createBody(difficulty.playerX, difficulty.worldHeight * 0.42);
    this.prevBody = this.body;
    this.hitboxRadius = difficulty.playerRadius * physics.playerHitboxScale;
  }

  /** Queue a tap; consumed at the next fixed step so runs stay deterministic. */
  tap(): void {
    if (this.phase === 'PLAY') this.tapQueued = true;
  }

  /**
   * Real-time entry point. Returns the interpolation alpha for rendering.
   * DEAD phase runs at 30% time scale for the drift/slow-mo death beat.
   */
  advance(realDtMs: number): number {
    const scale = this.phase === 'DEAD' ? 0.3 : 1;
    if (this.phase === 'DEAD') {
      this.deadTimerMs += realDtMs;
      if (this.deadTimerMs >= this.difficulty.deathSlowmoMs) {
        this.phase = 'OVER';
        this.events.onGameOver?.();
      }
    }
    if (this.phase === 'OVER') return 1;

    this.accumulator += (realDtMs / 1000) * scale;
    // Clamp runaway accumulators (tab stalls) to keep the sim responsive.
    if (this.accumulator > 0.25) this.accumulator = 0.25;
    while (this.accumulator >= this.physics.fixedStep) {
      this.accumulator -= this.physics.fixedStep;
      this.tick();
    }
    return this.accumulator / this.physics.fixedStep;
  }

  /** Advance exactly one fixed step. Tests drive this directly. */
  tick(): void {
    if (this.phase === 'OVER') return;
    this.prevBody = this.body;

    if (this.tapQueued) {
      this.body = applySwimImpulse(this.body, this.physics);
      this.tapQueued = false;
    }
    this.body = stepBody(this.body, this.physics, this.field, this.time);

    // Water surface: soft ceiling — clamp position, kill upward velocity.
    const surfaceY = this.hitboxRadius;
    if (this.body.y < surfaceY) {
      this.body = { ...this.body, y: surfaceY, vy: Math.max(0, this.body.vy) };
    }

    if (this.phase === 'PLAY') {
      this.spawner.update(this.physics.fixedStep, this.score);

      const gained = collectPassedGates(
        this.spawner.gates,
        this.difficulty.playerX,
        this.difficulty.pipeWidth,
      );
      if (gained > 0) {
        this.score += gained;
        this.events.onScore?.(this.score);
      }

      if (this.hitsSeabed() || this.hitsGate()) this.die();
    }

    this.time += this.physics.fixedStep;
    this.frame++;
  }

  private hitsSeabed(): boolean {
    return this.body.y + this.hitboxRadius >= this.difficulty.worldHeight;
  }

  private hitsGate(): boolean {
    const r = this.hitboxRadius;
    const w = this.difficulty.pipeWidth;
    const h = this.difficulty.worldHeight;
    for (const g of this.spawner.gates) {
      if (Math.abs(g.x - this.body.x) > w / 2 + r + 4) continue;
      const gapTop = g.gapCenterY - g.gapSize / 2;
      const gapBottom = g.gapCenterY + g.gapSize / 2;
      if (circleRectOverlap(this.body.x, this.body.y, r, g.x - w / 2, 0, w, gapTop)) return true;
      if (circleRectOverlap(this.body.x, this.body.y, r, g.x - w / 2, gapBottom, w, h - gapBottom))
        return true;
    }
    return false;
  }

  private die(): void {
    this.phase = 'DEAD';
    this.deadTimerMs = 0;
    this.events.onDeath?.();
  }

  /** Interpolated render position for a given alpha. */
  renderState(alpha: number): { x: number; y: number; vx: number; vy: number } {
    const a = Math.max(0, Math.min(1, alpha));
    return {
      x: this.prevBody.x + (this.body.x - this.prevBody.x) * a,
      y: this.prevBody.y + (this.body.y - this.prevBody.y) * a,
      vx: this.body.vx,
      vy: this.body.vy,
    };
  }

  gates(): readonly Gate[] {
    return this.spawner.gates;
  }
}
