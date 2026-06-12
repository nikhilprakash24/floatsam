import Phaser from 'phaser';
import physicsJson from '../config/physics.json';
import difficultyJson from '../config/difficulty.json';
import { Simulation } from '../core/sim/Simulation';
import { scrollSpeedFor } from '../core/spawn/Spawner';
import { transition } from '../core/state/fsm';
import { BEST_SCORE_KEY } from '../core/score/score';
import type { KVStore } from '../platform/Storage';
import { PlayerView } from '../entities/PlayerView';

const D = difficultyJson;

interface GateView {
  top: Phaser.GameObjects.Image;
  bottom: Phaser.GameObjects.Image;
}

export class GameScene extends Phaser.Scene {
  private sim!: Simulation;
  private player!: PlayerView;
  private gateViews: GateView[] = [];
  private bgFar!: Phaser.GameObjects.TileSprite;
  private bgMid!: Phaser.GameObjects.TileSprite;
  private bubbles!: Phaser.GameObjects.Particles.ParticleEmitter;
  private started = false;
  private overLaunched = false;

  constructor() {
    super('Game');
  }

  create(): void {
    this.registry.set('appState', transition(this.registry.get('appState'), 'PLAY'));
    this.started = false;
    this.overLaunched = false;

    // ?seed=N gives deterministic runs for e2e and debugging.
    const urlSeed = Number(new URLSearchParams(window.location.search).get('seed'));
    const seed = urlSeed > 0 ? urlSeed : (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    this.sim = new Simulation(physicsJson, D, seed, {
      onScore: (score) => this.registry.set('score', score),
      onDeath: () => this.onDeath(),
      onGameOver: () => this.onGameOver(),
    });
    this.registry.set('score', 0);

    this.bgFar = this.add.tileSprite(D.worldWidth / 2, D.worldHeight / 2, D.worldWidth, D.worldHeight, 'bgFar').setDepth(1);
    this.bgMid = this.add.tileSprite(D.worldWidth / 2, D.worldHeight / 2, D.worldWidth, D.worldHeight, 'bgMid').setDepth(2);

    this.gateViews = this.sim.gates().map(() => ({
      top: this.add.image(0, 0, 'reef').setOrigin(0.5, 1).setFlipY(true).setDepth(5),
      bottom: this.add.image(0, 0, 'reef').setOrigin(0.5, 0).setDepth(5),
    }));

    this.add.image(D.worldWidth / 2, D.worldHeight - 24, 'sand').setDepth(6);

    this.player = new PlayerView(this, D.playerX, D.worldHeight * 0.42);

    this.bubbles = this.add.particles(0, 0, 'bubble', {
      speedY: { min: -60, max: -25 },
      speedX: { min: -12, max: 6 },
      scale: { start: 0.45, end: 0.9 },
      alpha: { start: 0.8, end: 0 },
      lifespan: 1400,
      frequency: 220,
      follow: this.player.sprite,
      followOffset: { x: -26, y: -4 },
    });
    this.bubbles.setDepth(9);

    // Idle hint until the first tap starts the run.
    const hint = this.add
      .text(D.worldWidth / 2, D.worldHeight * 0.62, 'tap to swim', {
        fontFamily: '"Trebuchet MS", sans-serif',
        fontSize: '26px',
        color: '#cfe9f2',
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.tweens.add({ targets: hint, alpha: 0.35, duration: 600, yoyo: true, repeat: -1 });

    this.input.on('pointerdown', () => {
      if (!this.started) {
        this.started = true;
        hint.destroy();
      }
      if (this.sim.phase === 'PLAY') {
        this.sim.tap();
        this.player.pulse(this);
        this.bubbles.emitParticleAt(this.player.sprite.x - 26, this.player.sprite.y, 3);
      }
    });

    this.scene.launch('Hud');
  }

  override update(_time: number, delta: number): void {
    // Test/debug hook: headless e2e reads this to assert game state.
    const hitR = this.sim.hitboxRadius;
    const nextGate = [...this.sim.gates()]
      .filter((g) => g.x + D.pipeWidth / 2 + hitR > this.sim.body.x)
      .sort((a, b) => a.x - b.x)[0];
    (window as { __sim?: object }).__sim = {
      y: this.sim.body.y,
      vy: this.sim.body.vy,
      score: this.sim.score,
      phase: this.sim.phase,
      frame: this.sim.frame,
      started: this.started,
      gate: nextGate ? { x: nextGate.x, c: nextGate.gapCenterY, gap: nextGate.gapSize } : null,
    };

    // Hold the world still until the first tap (classic flappy idle).
    if (!this.started) {
      this.layoutGates();
      this.player.update(D.playerX, D.worldHeight * 0.42 + Math.sin(this.time.now / 400) * 8, 0, scrollSpeedFor(0, D));
      return;
    }

    const alpha = this.sim.advance(delta);
    const speed = scrollSpeedFor(this.sim.score, D);

    this.bgFar.tilePositionX += speed * 0.12 * (delta / 1000);
    this.bgMid.tilePositionX += speed * 0.35 * (delta / 1000);

    this.layoutGates(alpha, speed);

    const r = this.sim.renderState(alpha);
    this.player.update(r.x, r.y, r.vy, speed);
  }

  private layoutGates(alpha = 1, speed = 0): void {
    const back = (1 - alpha) * speed * this.sim.physics.fixedStep;
    this.sim.gates().forEach((g, i) => {
      const view = this.gateViews[i];
      if (!view) return;
      const x = g.x - back;
      view.top.setPosition(x, g.gapCenterY - g.gapSize / 2);
      view.bottom.setPosition(x, g.gapCenterY + g.gapSize / 2);
    });
  }

  private onDeath(): void {
    this.registry.set('appState', transition('PLAY', 'DEAD'));
    this.cameras.main.shake(180, 0.012);
    this.cameras.main.flash(120, 200, 60, 60);

    const best = this.registry.get('best') as number;
    if (this.sim.score > best) {
      this.registry.set('best', this.sim.score);
      (this.registry.get('store') as KVStore).set(BEST_SCORE_KEY, String(this.sim.score));
    }
  }

  private onGameOver(): void {
    if (this.overLaunched) return;
    this.overLaunched = true;
    this.registry.set('appState', transition('DEAD', 'GAMEOVER'));
    this.scene.launch('GameOver', { score: this.sim.score, best: this.registry.get('best') });
  }
}
