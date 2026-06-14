import { createBody, stepBody, type FluidBodyState, type FluidPhysicsConfig } from '../fluid/FluidBody';
import type { FluidField } from '../fluid/FluidField';
import type { InputPolicy } from '../input/InputPolicy';
import type { GameMode } from '../modes/GameMode';
import { deriveEffective, type CharacterProfile } from '../character/CharacterProfile';
import { GateSpawner, type DifficultyConfig, type Gate } from '../spawn/Spawner';
import { collectPassedGates } from '../score/score';
import { createRng } from '../rng';

/** The umbrella shape of physics.json (integrator + render/hitbox extras). */
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
 * The whole game, headless, parameterized by a (GameMode × CharacterProfile)
 * pair (v3.3 §3.2). Fixed 1/60 s steps behind an accumulator; rendering
 * interpolates. Determinism is keyed per (seed, mode, character) — identical
 * inputs reproduce identical runs (§3.1 rule 3). FluidBody is the only
 * integrator (rule 4); effective constants are derived once at construction.
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
  readonly hitboxRadius: number;
  /** Effective continuous-force config (mode × character). */
  readonly physics: FluidPhysicsConfig;
  readonly difficulty: DifficultyConfig;

  private accumulator = 0;
  private pressQueued = false;
  private holdUp = false;
  private holdDown = false;
  private deadTimerMs = 0;
  private readonly field: FluidField;
  private readonly policy: InputPolicy;
  private readonly massScale: number;

  constructor(
    readonly mode: GameMode,
    readonly character: CharacterProfile,
    seed: number,
    private readonly events: SimEvents = {},
  ) {
    const eff = deriveEffective(mode.physics, character);
    this.physics = eff;
    this.difficulty = mode.spawn;
    this.massScale = eff.massScale;
    this.field = mode.makeField(eff);
    this.policy = mode.makeInputPolicy(eff);
    this.spawner = new GateSpawner(mode.spawn, createRng(seed));
    this.body = createBody(mode.spawn.playerX, mode.spawn.worldHeight * 0.42);
    this.prevBody = this.body;
    this.hitboxRadius = eff.hitboxRadius;
  }

  /** Queue a discrete press (Classic tap); consumed at the next fixed step. */
  tap(): void {
    if (this.phase === 'PLAY') this.pressQueued = true;
  }

  /** Set held intent (BiAxial up/down); takes effect from the next step. */
  setHold(up: boolean, down: boolean): void {
    this.holdUp = up && this.phase === 'PLAY';
    this.holdDown = down && this.phase === 'PLAY';
  }

  /** Current impulse reservoir (telemetry/replay observability). */
  get pendingImpulse(): number {
    return this.policy.reservoir();
  }

  get fixedStep(): number {
    return this.physics.fixedStep;
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

    if (this.pressQueued) {
      this.policy.press();
      this.pressQueued = false;
    }
    this.policy.setHold(this.holdUp, this.holdDown);
    const thrust = this.policy.step(this.physics.fixedStep);
    this.body = stepBody(this.body, this.physics, this.field, this.time, thrust, this.massScale);

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
