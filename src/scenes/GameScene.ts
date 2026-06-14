import Phaser from 'phaser';
import difficultyJson from '../config/difficulty.json';
import { Simulation } from '../core/sim/Simulation';
import { CLASSIC_MODE } from '../core/modes/classicMode';
import { scrollSpeedFor } from '../core/spawn/Spawner';
import { transition } from '../core/state/fsm';
import { BEST_SCORE_KEY } from '../core/score/score';
import type { KVStore } from '../platform/Storage';
import type { SfxSynth } from '../platform/audio';
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
  private sfx!: SfxSynth;
  private fx: Phaser.GameObjects.GameObject[] = [];
  private fxChecked = false;

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
    this.sim = new Simulation(CLASSIC_MODE, seed, {
      onScore: (score) => {
        this.registry.set('score', score);
        this.sfx.score();
      },
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

    this.sfx = this.registry.get('sfx') as SfxSynth;

    this.input.on('pointerdown', () => {
      this.sfx.unlock();
      this.sfx.startAmbient();
      if (!this.started) {
        this.started = true;
        hint.destroy();
      }
      if (this.sim.phase === 'PLAY') {
        this.sim.tap();
        this.sfx.tap();
        this.player.pulse(this);
        this.bubbles.emitParticleAt(this.player.sprite.x - 26, this.player.sprite.y, 3);
      }
    });

    this.addEffects();
    this.bindVisibilityPause();
    this.scene.launch('Hud');
  }

  /** Caustic light shafts + vignette; cheap, and removed if FPS dips (§8). */
  private addEffects(): void {
    if (this.registry.get('fxLow') === true) return;
    for (const [x, sway, dur] of [
      [120, 26, 5200],
      [280, -34, 6800],
      [400, 22, 6000],
    ] as const) {
      const ray = this.add
        .image(x, 0, 'ray')
        .setOrigin(0.5, 0)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(7)
        .setAlpha(0.8);
      this.tweens.add({
        targets: ray,
        x: x + sway,
        alpha: 0.45,
        duration: dur,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.fx.push(ray);
    }
    this.fx.push(this.add.image(D.worldWidth / 2, D.worldHeight / 2, 'vignette').setDepth(30));
  }

  private bindVisibilityPause(): void {
    const onHidden = (): void => {
      if (this.started && this.sim.phase === 'PLAY' && !this.scene.isPaused()) {
        this.scene.launch('Pause');
        this.scene.pause();
      }
    };
    this.game.events.on(Phaser.Core.Events.HIDDEN, onHidden);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.HIDDEN, onHidden);
    });
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

    // One-shot FPS probe ~6 s into the run: drop effects on weak devices.
    if (!this.fxChecked && this.sim.time > 6) {
      this.fxChecked = true;
      if (this.game.loop.actualFps < 45 && this.fx.length > 0) {
        this.registry.set('fxLow', true);
        for (const o of this.fx) o.destroy();
        this.fx = [];
      }
    }

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
    this.sfx.death();
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
