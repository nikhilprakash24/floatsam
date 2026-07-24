import { createBody, stepBody, type FluidBodyState, type FluidPhysicsConfig } from '../fluid/FluidBody';
import type { FluidField } from '../fluid/FluidField';
import type { InputPolicy } from '../input/InputPolicy';
import type { GameMode } from '../modes/GameMode';
import { deriveEffective, OTTER, type CharacterProfile } from '../character/CharacterProfile';
import { GateSpawner, scrollSpeedFor, type DifficultyConfig, type Gate } from '../spawn/Spawner';
import { clampsFor, gapScaleFor } from '../spawn/clampsFor';
import { collectPassedGates } from '../score/score';
import { createRng } from '../rng';
import { CompositeField } from '../fluid/fields/CompositeField';
import { CurrentSpawner, ScrollingCurrentField, type CurrentCell } from '../fluid/currents/CurrentSpawner';
import { type CellKind } from '../fluid/currents/cells';
import { SurgeScheduler, SurgeField, type SurgeConfig } from '../fluid/currents/Surge';
import currentsCfg from '../../config/currents.json';
import powerJson from '../../config/modes/powerdive.json';

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
  /** Present only when currents are enabled for this run (opt-in, default off). */
  private readonly currentSpawner?: CurrentSpawner;
  /** Present only when the rare whole-screen Surge is enabled for this run. */
  private readonly surge?: SurgeScheduler;

  constructor(
    readonly mode: GameMode,
    readonly character: CharacterProfile,
    seed: number,
    private readonly events: SimEvents = {},
    pace = 1,
    /** Override the config's per-mode currents flag (sandbox / ?currents=1). */
    currents?: boolean,
    /** Override the config's per-mode surge flag (sandbox / ?surge=1). */
    surge?: boolean,
  ) {
    const eff = deriveEffective(mode.physics, character);
    this.physics = eff;
    // Pace wrapper: scale only the scroll-speed fields. The spawner derives the
    // inter-gate time from the scaled speed, so fairness clamps tighten with
    // tempo automatically. pace === 1 leaves mode.spawn untouched (the value the
    // golden master + 10k sweep were verified against — bit-identical).
    this.difficulty =
      pace === 1
        ? mode.spawn
        : {
            ...mode.spawn,
            scrollSpeedBase: mode.spawn.scrollSpeedBase * pace,
            scrollSpeedMax: mode.spawn.scrollSpeedMax * pace,
            speedRampPerPoint: mode.spawn.speedRampPerPoint * pace,
          };
    this.massScale = eff.massScale;

    // Currents seam (currents program C4). Opt-in and default-off, so every
    // existing run — Classic golden included — is bit-identical: when currents
    // are off, `field` is exactly `mode.makeField(eff)`. When on, a seeded
    // CurrentSpawner (its OWN rng stream, so gate spawning is untouched) feeds a
    // ScrollingCurrentField composed on top, clamped to the weakest creature's
    // escape budget so escapability is guaranteed no matter how cells stack.
    let field = mode.makeField(eff);
    const modeCfg = (currentsCfg.modes as Record<string, { cells: boolean; surge: boolean }>)[mode.id];
    const currentsOn = currents ?? modeCfg?.cells ?? false;
    if (currentsOn) {
      const cc = currentsCfg.cells;
      const B = currentsCfg.budgets;
      const tUp = powerJson.biaxial.thrustUp * OTTER.thrustScale;
      const tDown = powerJson.biaxial.thrustDown * OTTER.thrustScale;
      this.currentSpawner = new CurrentSpawner(
        {
          worldW: this.difficulty.worldWidth,
          worldH: this.difficulty.worldHeight,
          spacing: cc.spacing,
          intensity: cc.intensity,
          kinds: cc.kinds as CellKind[],
          firstX: cc.firstX,
          marginY: cc.marginY,
        },
        createRng((seed ^ 0x9e3779b9) >>> 0),
      );
      // The rare whole-screen Surge (opt-in within currents). Its own rng stream
      // and shares the cells' single clamp (passed as `extra`), so cells + surge
      // can never jointly exceed the escape budget.
      const surgeOn = surge ?? modeCfg?.surge ?? false;
      let extra: SurgeField | undefined;
      if (surgeOn) {
        this.surge = new SurgeScheduler(currentsCfg.surge as SurgeConfig, createRng((seed ^ 0x85ebca6b) >>> 0));
        extra = new SurgeField(this.surge, currentsCfg.surge.intensity);
      }
      field = new CompositeField([
        field,
        new ScrollingCurrentField(this.currentSpawner, tUp * B.upFrac, tDown * B.downFrac, tUp * B.latFrac, extra),
      ]);
    }
    this.field = field;
    this.policy = mode.makeInputPolicy(eff);
    this.spawner = new GateSpawner(
      this.difficulty,
      createRng(seed),
      clampsFor(character, mode),
      gapScaleFor(character, mode),
    );
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

    // Free-x modes (Power Dive): keep the body inside its horizontal band.
    if (this.mode.freeX) {
      const xMin = this.difficulty.playerXMin ?? this.difficulty.playerX;
      const xMax = this.difficulty.playerXMax ?? this.difficulty.playerX;
      if (this.body.x < xMin) this.body = { ...this.body, x: xMin, vx: Math.max(0, this.body.vx) };
      else if (this.body.x > xMax) this.body = { ...this.body, x: xMax, vx: Math.min(0, this.body.vx) };
    }

    if (this.phase === 'PLAY') {
      this.spawner.update(this.physics.fixedStep, this.score);
      // Currents scroll at the world speed so cells align with what's drawn.
      this.currentSpawner?.update(this.physics.fixedStep, scrollSpeedFor(this.score, this.difficulty));
      this.surge?.update(this.physics.fixedStep);

      // Free-x modes score on the body's actual x (it can move forward past a
      // gate); fixed-x modes score on the static player line (bit-identical).
      const scoreX = this.mode.freeX ? this.body.x : this.difficulty.playerX;
      const gained = collectPassedGates(this.spawner.gates, scoreX, this.difficulty.pipeWidth);
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

  /** Live current cells for rendering/telegraph; empty when currents are off. */
  currentCells(): readonly CurrentCell[] {
    return this.currentSpawner?.cells ?? [];
  }

  get hasCurrents(): boolean {
    return this.currentSpawner !== undefined;
  }

  /** Surge envelope in [0,1] for the screen cue; 0 when no surge is configured. */
  get surgeRamp(): number {
    return this.surge?.ramp ?? 0;
  }
}
