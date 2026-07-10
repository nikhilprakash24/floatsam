import Phaser from 'phaser';
import difficulty from '../config/difficulty.json';
import diveJson from '../config/modes/dive.json';
import { createBody, stepBody, type FluidBodyState, type FluidPhysicsConfig } from '../core/fluid/FluidBody';
import { ConstantBuoyancyField, type FluidField } from '../core/fluid/FluidField';
import { CompositeField } from '../core/fluid/fields/CompositeField';
import { LAB_PRESETS, buildPresetField } from '../core/fluid/fields/presets';
import { BiAxialPolicy } from '../core/input/BiAxialPolicy';
import { CHARACTERS, deriveEffective } from '../core/character/CharacterProfile';
import { PlayerView } from '../entities/PlayerView';
import { FieldVisualizer } from '../debug/FieldVisualizer';
import { makeButton, makeBackButton } from '../ui/Button';

const W = difficulty.worldWidth;
const H = difficulty.worldHeight;
const FONT = '"Trebuchet MS", sans-serif';
const DIVE = diveJson as {
  physics: FluidPhysicsConfig;
  biaxial: { thrustUp: number; thrustDown: number; attackMs: number; decayMs: number };
};

/**
 * Currents Lab (ARCHITECTURE v3.3 §1, Phase 7) — the internal testing ground
 * for the real vector FluidField. Free-swim a chosen creature through authored
 * current presets with the flow visualized; tune by eye. Dev/testing surface;
 * compiled out of store builds (ADR-011).
 */
export class LabScene extends Phaser.Scene {
  private presetIdx = 0;
  private charIdx = 0;
  private body!: FluidBodyState;
  private prev!: FluidBodyState;
  private bodyField!: FluidField;
  private currentField!: FluidField;
  private policy!: BiAxialPolicy;
  private cfg!: FluidPhysicsConfig;
  private massScale = 1;
  private player!: PlayerView;
  private viz!: FieldVisualizer;
  private hud!: Phaser.GameObjects.Text;
  private presetLabel!: Phaser.GameObjects.Text;
  private charLabel!: Phaser.GameObjects.Text;
  private accumulator = 0;
  private simTime = 0;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;

  constructor() {
    super('Lab');
  }

  create(): void {
    this.add.rectangle(W / 2, H / 2, W, H, 0x062430).setDepth(0);
    this.add.tileSprite(W / 2, H / 2, W, H, 'bgMid').setDepth(0).setAlpha(0.35);

    this.body = createBody(W / 2, H / 2);
    this.prev = this.body;
    this.accumulator = 0;
    this.simTime = 0;
    this.rebuild();

    this.viz = new FieldVisualizer(this, this.currentField, W, H);
    this.player = new PlayerView(this, this.body.x, this.body.y, CHARACTERS[this.charIdx]!.id);
    this.player.sprite.setDepth(10);

    // Telemetry.
    this.hud = this.add
      .text(12, 84, '', { fontFamily: 'monospace', fontSize: '13px', color: '#d8f3ff', backgroundColor: '#06222db0', padding: { x: 7, y: 5 } })
      .setDepth(50);

    // Title + preset/character switchers.
    this.add.text(W / 2, 24, 'CURRENTS LAB', { fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: '#bfe9f2' }).setOrigin(0.5).setDepth(50);
    this.presetLabel = this.add.text(W / 2, H - 96, '', { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: '#ffd97a' }).setOrigin(0.5).setDepth(50);
    this.charLabel = this.add.text(W / 2, H - 40, '', { fontFamily: FONT, fontSize: '16px', color: '#9fd8cf' }).setOrigin(0.5).setDepth(50);

    makeButton(this, 54, H - 96, '‹', () => this.cyclePreset(-1), { width: 48, height: 42, fontSize: 26, accent: 0x4aa3e0 }).setDepth(50);
    makeButton(this, W - 54, H - 96, '›', () => this.cyclePreset(1), { width: 48, height: 42, fontSize: 26, accent: 0x4aa3e0 }).setDepth(50);
    makeButton(this, 80, H - 40, 'creature ⟳', () => this.cycleChar(), { variant: 'ghost', width: 140, height: 36, fontSize: 15 }).setDepth(50);
    makeButton(this, W - 70, H - 40, 'reset', () => this.resetBody(), { variant: 'ghost', width: 110, height: 36, fontSize: 15 }).setDepth(50);

    this.add
      .text(W / 2, H - 16, 'rise: top / left-click / ↑   ·   dive: bottom / right-click / ↓', { fontFamily: FONT, fontSize: '13px', color: '#7fb0c0' })
      .setOrigin(0.5)
      .setDepth(50);

    makeBackButton(this, '◀ menu', () => this.scene.start('Menu')).setDepth(50);

    this.input.mouse?.disableContextMenu();
    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.keyW = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyS = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S);

    this.updateLabels();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.viz.destroy());
  }

  /** Rebuild field/policy/cfg for the current preset × character. */
  private rebuild(): void {
    const char = CHARACTERS[this.charIdx]!;
    const eff = deriveEffective(DIVE.physics, char);
    this.cfg = eff;
    this.massScale = char.massScale;
    this.currentField = buildPresetField(LAB_PRESETS[this.presetIdx]!);
    this.bodyField = new CompositeField([new ConstantBuoyancyField(eff.buoyancyAccel), this.currentField]);
    this.policy = new BiAxialPolicy({
      thrustUp: DIVE.biaxial.thrustUp * char.thrustScale,
      thrustDown: DIVE.biaxial.thrustDown * char.thrustScale,
      attackMs: DIVE.biaxial.attackMs,
      decayMs: DIVE.biaxial.decayMs,
    });
  }

  private cyclePreset(dir: number): void {
    this.presetIdx = (this.presetIdx + dir + LAB_PRESETS.length) % LAB_PRESETS.length;
    this.rebuild();
    this.viz.setField(this.currentField);
    this.updateLabels();
  }

  private cycleChar(): void {
    this.charIdx = (this.charIdx + 1) % CHARACTERS.length;
    this.rebuild();
    this.player.sprite.setTexture(CHARACTERS[this.charIdx]!.id);
    this.updateLabels();
  }

  private resetBody(): void {
    this.body = createBody(W / 2, H / 2);
    this.prev = this.body;
    this.policy.reset();
  }

  private updateLabels(): void {
    this.presetLabel.setText(LAB_PRESETS[this.presetIdx]!.name);
    this.charLabel.setText(CHARACTERS[this.charIdx]!.name);
  }

  private pollHold(): { up: boolean; down: boolean } {
    let up = this.cursors.up.isDown || this.keyW.isDown;
    let down = this.cursors.down.isDown || this.keyS.isDown;
    const ptr = this.input.activePointer;
    if (ptr.isDown) {
      if (ptr.wasTouch) {
        if (ptr.worldY < H / 2) up = true;
        else down = true;
      } else {
        if (ptr.leftButtonDown()) up = true;
        if (ptr.rightButtonDown()) down = true;
      }
    }
    return { up, down };
  }

  override update(_time: number, delta: number): void {
    const { up, down } = this.pollHold();
    this.accumulator += Math.min(delta / 1000, 0.25);
    while (this.accumulator >= this.cfg.fixedStep) {
      this.accumulator -= this.cfg.fixedStep;
      this.prev = this.body;
      this.policy.setHold(up, down);
      const thrust = this.policy.step(this.cfg.fixedStep);
      this.body = stepBody(this.body, this.cfg, this.bodyField, this.simTime, thrust, this.massScale);
      this.simTime += this.cfg.fixedStep;
      this.wrap();
    }
    const a = this.accumulator / this.cfg.fixedStep;
    const x = this.prev.x + (this.body.x - this.prev.x) * a;
    const y = this.prev.y + (this.body.y - this.prev.y) * a;
    this.player.update(x, y, this.body.vy, 130);

    this.viz.update(delta / 1000, this.simTime);

    const f = this.currentField.sampleForce(this.body.x, this.body.y, this.simTime);
    this.hud.setText(
      [
        `fps    ${this.game.loop.actualFps.toFixed(0)}`,
        `vel    ${this.body.vx.toFixed(0)}, ${this.body.vy.toFixed(0)} px/s`,
        `current ${f.x.toFixed(0)}, ${f.y.toFixed(0)} px/s²`,
      ].join('\n'),
    );
  }

  /** Keep the body inside the column; bleed velocity at the walls. */
  private wrap(): void {
    const r = 24;
    if (this.body.x < r) this.body = { ...this.body, x: r, vx: Math.max(0, this.body.vx) };
    if (this.body.x > W - r) this.body = { ...this.body, x: W - r, vx: Math.min(0, this.body.vx) };
    if (this.body.y < r) this.body = { ...this.body, y: r, vy: Math.max(0, this.body.vy) };
    if (this.body.y > H - r) this.body = { ...this.body, y: H - r, vy: Math.min(0, this.body.vy) };
  }
}
