import Phaser from 'phaser';
import physicsJson from '../config/physics.json';
import difficulty from '../config/difficulty.json';
import { createBody, stepBody, terminalSpeed, type FluidBodyState } from '../core/fluid/FluidBody';
import { ConstantBuoyancyField } from '../core/fluid/FluidField';
import { TapUpPolicy } from '../core/input/TapUpPolicy';
import { PlayerView } from '../entities/PlayerView';

const W = difficulty.worldWidth;
const H = difficulty.worldHeight;
const FONT = '"Trebuchet MS", sans-serif';

const SLIDERS: { key: keyof typeof physicsJson; min: number; max: number; step: number }[] = [
  { key: 'gravity', min: 400, max: 900, step: 10 },
  { key: 'buoyancyAccel', min: 300, max: 800, step: 10 },
  { key: 'dragCoefficient', min: 0.004, max: 0.02, step: 0.0005 },
  { key: 'swimImpulse', min: 250, max: 550, step: 10 },
  { key: 'swimBlendSteps', min: 2, max: 4, step: 1 },
  { key: 'maxRiseSpeed', min: 300, max: 600, step: 10 },
  { key: 'maxSinkSpeed', min: 150, max: 350, step: 10 },
];

/**
 * Phase 1 physics sandbox (G1): the player in an empty water column with
 * every physics.json constant on a live slider, plus FPS + telemetry.
 */
export class SandboxScene extends Phaser.Scene {
  private cfg = { ...physicsJson };
  private body!: FluidBodyState;
  private prev!: FluidBodyState;
  private field = new ConstantBuoyancyField(this.cfg.buoyancyAccel);
  private policy = new TapUpPolicy(this.cfg);
  private player!: PlayerView;
  private accumulator = 0;
  private simTime = 0;
  private hud!: Phaser.GameObjects.Text;
  private panel?: HTMLDivElement;

  constructor() {
    super('Sandbox');
  }

  create(): void {
    this.cfg = { ...physicsJson };
    this.field = new ConstantBuoyancyField(this.cfg.buoyancyAccel);
    this.policy = new TapUpPolicy(this.cfg);
    this.body = createBody(W * 0.4, H * 0.4);
    this.prev = this.body;
    this.accumulator = 0;
    this.simTime = 0;

    this.add.tileSprite(W / 2, H / 2, W, H, 'bgFar');
    this.add.tileSprite(W / 2, H / 2, W, H, 'bgMid');
    this.add.image(W / 2, H - 24, 'sand');
    this.player = new PlayerView(this, this.body.x, this.body.y);

    this.hud = this.add
      .text(12, 12, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#d8f3ff',
        backgroundColor: '#06303fb0',
        padding: { x: 8, y: 6 },
      })
      .setDepth(50);

    this.add
      .text(12, H - 10, '◀ menu', { fontFamily: FONT, fontSize: '16px', color: '#7fa8b8' })
      .setOrigin(0, 1)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation();
        this.scene.start('Menu');
      });

    this.input.on('pointerdown', () => {
      this.policy.press();
      this.player.pulse(this);
    });

    this.buildPanel();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.panel?.remove());
  }

  override update(_time: number, delta: number): void {
    this.accumulator += Math.min(delta / 1000, 0.25);
    while (this.accumulator >= this.cfg.fixedStep) {
      this.accumulator -= this.cfg.fixedStep;
      this.prev = this.body;
      this.body = stepBody(this.body, this.cfg, this.field, this.simTime, this.policy.step(this.cfg.fixedStep));
      this.simTime += this.cfg.fixedStep;
      // Sandbox never kills: wrap softly at floor/surface.
      const r = difficulty.playerRadius;
      if (this.body.y > H - 48 - r) this.body = { ...this.body, y: H - 48 - r, vy: 0 };
      if (this.body.y < r) this.body = { ...this.body, y: r, vy: Math.max(0, this.body.vy) };
    }

    const a = this.accumulator / this.cfg.fixedStep;
    const x = this.prev.x + (this.body.x - this.prev.x) * a;
    const y = this.prev.y + (this.body.y - this.prev.y) * a;
    this.player.update(x, y, this.body.vy, 130);

    const net = this.cfg.gravity - this.cfg.buoyancyAccel;
    this.hud.setText(
      [
        `fps  ${this.game.loop.actualFps.toFixed(0)}`,
        `vy   ${this.body.vy.toFixed(1)} px/s`,
        `term ${terminalSpeed(net, this.cfg.dragCoefficient).toFixed(1)} px/s (net ${net})`,
      ].join('\n'),
    );
  }

  private buildPanel(): void {
    const panel = document.createElement('div');
    panel.style.cssText =
      'position:fixed;top:8px;right:8px;z-index:10;background:#06303fd9;color:#d8f3ff;' +
      'font:12px monospace;padding:10px 12px;border-radius:8px;width:240px;user-select:none';
    panel.innerHTML = '<b>physics.json — live</b><br/>';

    for (const s of SLIDERS) {
      const row = document.createElement('div');
      row.style.cssText = 'margin-top:7px';
      const label = document.createElement('div');
      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(s.min);
      input.max = String(s.max);
      input.step = String(s.step);
      input.value = String(this.cfg[s.key]);
      input.style.width = '100%';
      const fmt = (v: number) => (s.step < 0.01 ? v.toFixed(4) : String(v));
      label.textContent = `${s.key}: ${fmt(Number(input.value))}`;
      input.oninput = () => {
        const v = Number(input.value);
        (this.cfg[s.key] as number) = v;
        label.textContent = `${s.key}: ${fmt(v)}`;
        if (s.key === 'buoyancyAccel') this.field = new ConstantBuoyancyField(v);
      };
      row.append(label, input);
      panel.append(row);
    }

    const hint = document.createElement('div');
    hint.style.cssText = 'margin-top:8px;color:#8fc3d4';
    hint.textContent = 'tap canvas to swim · values are session-only';
    panel.append(hint);

    document.body.append(panel);
    this.panel = panel;
  }
}
