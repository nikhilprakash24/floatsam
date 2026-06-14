import { type Rng, rngRange } from '../rng';

export interface DifficultyConfig {
  scrollSpeedBase: number;
  scrollSpeedMax: number;
  speedRampPerPoint: number;
  gapStart: number;
  gapMin: number;
  gapShrinkPerPoint: number;
  spawnSpacing: number;
  firstGateX: number;
  gapCenterMinY: number;
  gapCenterMaxY: number;
  maxRisePerSecond: number;
  maxSinkPerSecond: number;
  fairnessSafety: number;
  pipeWidth: number;
  deathSlowmoMs: number;
  worldWidth: number;
  worldHeight: number;
  playerX: number;
  playerRadius: number;
}

export interface Gate {
  id: number;
  x: number;
  gapCenterY: number;
  gapSize: number;
  scored: boolean;
}

export function scrollSpeedFor(score: number, cfg: DifficultyConfig): number {
  return Math.min(cfg.scrollSpeedMax, cfg.scrollSpeedBase + cfg.speedRampPerPoint * score);
}

export function gapSizeFor(score: number, cfg: DifficultyConfig): number {
  return Math.max(cfg.gapMin, cfg.gapStart - cfg.gapShrinkPerPoint * score);
}

/**
 * Object-pooled, seeded gate generator. Gates scroll left past the fixed
 * player; off-screen gates are recycled to the right edge with fresh,
 * fairness-clamped gap parameters — no allocation during play.
 */
export interface SpawnClamps {
  maxRisePerSecond: number;
  maxSinkPerSecond: number;
}

export class GateSpawner {
  readonly gates: Gate[] = [];
  private lastGapCenterY: number;
  private nextId = 0;
  private readonly clampUp: number;
  private readonly clampDown: number;

  constructor(
    private readonly cfg: DifficultyConfig,
    private readonly rng: Rng,
    clamps?: SpawnClamps,
  ) {
    // Per-(character × mode) reachability clamps; defaults to the config's own
    // values so direct construction (unit tests) keeps the shipped behavior.
    this.clampUp = clamps?.maxRisePerSecond ?? cfg.maxRisePerSecond;
    this.clampDown = clamps?.maxSinkPerSecond ?? cfg.maxSinkPerSecond;
    this.lastGapCenterY = (cfg.gapCenterMinY + cfg.gapCenterMaxY) / 2;
    const poolSize = Math.ceil(cfg.worldWidth / cfg.spawnSpacing) + 2;
    for (let i = 0; i < poolSize; i++) {
      this.gates.push(this.makeGate(cfg.firstGateX + i * cfg.spawnSpacing, 0));
    }
  }

  /**
   * Fairness clamp (§6 Phase 2, validated by the 10k-run sim): the next gap
   * center must be reachable from the previous one given how fast the player
   * can rise/sink in the time between gates, with a safety margin.
   */
  private nextGapCenter(score: number, gapSize: number): number {
    const speed = scrollSpeedFor(score, this.cfg);
    const t = this.cfg.spawnSpacing / speed;
    const maxUp = this.clampUp * t * this.cfg.fairnessSafety;
    const maxDown = this.clampDown * t * this.cfg.fairnessSafety;
    const half = gapSize / 2;
    const lo = Math.max(this.cfg.gapCenterMinY, half + 20, this.lastGapCenterY - maxUp);
    const hi = Math.min(
      this.cfg.gapCenterMaxY,
      this.cfg.worldHeight - half - 20,
      this.lastGapCenterY + maxDown,
    );
    const center = rngRange(this.rng, lo, Math.max(lo, hi));
    this.lastGapCenterY = center;
    return center;
  }

  private makeGate(x: number, score: number): Gate {
    const gapSize = gapSizeFor(score, this.cfg);
    return {
      id: this.nextId++,
      x,
      gapCenterY: this.nextGapCenter(score, gapSize),
      gapSize,
      scored: false,
    };
  }

  /** Advance gates one step; recycle any that scrolled fully off-screen. */
  update(dt: number, score: number): void {
    const speed = scrollSpeedFor(score, this.cfg);
    let rightmost = -Infinity;
    for (const g of this.gates) {
      g.x -= speed * dt;
      if (g.x > rightmost) rightmost = g.x;
    }
    for (const g of this.gates) {
      if (g.x < -this.cfg.pipeWidth) {
        const gapSize = gapSizeFor(score, this.cfg);
        g.x = rightmost + this.cfg.spawnSpacing;
        g.gapCenterY = this.nextGapCenter(score, gapSize);
        g.gapSize = gapSize;
        g.scored = false;
        rightmost = g.x;
      }
    }
  }
}
