import Phaser from 'phaser';
import difficulty from '../config/difficulty.json';
import powerJson from '../config/modes/powerdive.json';
import { createBody, stepBody, type FluidBodyState, type FluidPhysicsConfig } from '../core/fluid/FluidBody';
import { ConstantBuoyancyField, type FluidField } from '../core/fluid/FluidField';
import { CompositeField } from '../core/fluid/fields/CompositeField';
import { HomeSpringField } from '../core/fluid/fields/HomeSpringField';
import { DEFAULT_KNOBS, FABLE_PRESETS, KNOB_RANGES, type FableKnobs } from '../core/fluid/fields/fablePresets';
import { PowerDivePolicy } from '../core/input/PowerDivePolicy';
import { CHARACTERS, deriveEffective } from '../core/character/CharacterProfile';
import { PlayerView } from '../entities/PlayerView';
import { FieldVisualizer } from '../debug/FieldVisualizer';
import { makeButton, makeBackButton } from '../ui/Button';

const W = difficulty.worldWidth;
const H = difficulty.worldHeight;
const FONT = '"Trebuchet MS", sans-serif';
const PD = powerJson as {
  physics: FluidPhysicsConfig;
  biaxial: { thrustUp: number; thrustDown: number; attackMs: number; decayMs: number };
  thrustForward: number;
  springK: number;
};

/**
 * FABLE CURRENTS — a fork of the Currents Lab where currents are a
 * *difficulty instrument*. Free-swims the POWER DIVE policy (dive = down +
 * forward) through Fable-authored current designs, with the whole system on
 * live knobs: intensity, assistBias (kind ↔ spiteful ocean), turbulence,
 * pulsePeriod, and lungeSynergy — how much a tailwind supercharges (and a
 * headwind saps) the forward lunge. Everything budget-clamped to stay
 * escapable by the weakest creature.
 */
export class FableLabScene extends Phaser.Scene {
  private knobs: FableKnobs = { ...DEFAULT_KNOBS };
  private presetIdx = 0;
  private charIdx = 0;
  private body!: FluidBodyState;
  private prev!: FluidBodyState;
  private currentField!: FluidField;
  private bodyField!: FluidField;
  private policy!: PowerDivePolicy;
  private cfg!: FluidPhysicsConfig;
  private massScale = 1;
  private player!: PlayerView;
  private viz!: FieldVisualizer;
  private hud!: Phaser.GameObjects.Text;
  private presetLabel!: Phaser.GameObjects.Text;
  private noteLabel!: Phaser.GameObjects.Text;
  private charLabel!: Phaser.GameObjects.Text;
  private panel?: HTMLDivElement;
  private accumulator = 0;
  private simTime = 0;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;

  constructor() {
    super('FableLab');
  }

  create(): void {
    this.add.image(W / 2, H / 2, 'bgGradient').setTint(0xd8c8ff).setAlpha(0.9);
    this.add.rectangle(W / 2, H / 2, W, H, 0x0a1c2e, 0.45);
    this.add.tileSprite(W / 2, H / 2, W, H, 'bgMid').setAlpha(0.3);

    this.body = createBody(W / 2, H / 2);
    this.prev = this.body;
    this.accumulator = 0;
    this.simTime = 0;
    this.rebuild();

    this.viz = new FieldVisualizer(this, this.currentField, W, H);
    this.player = new PlayerView(this, this.body.x, this.body.y, CHARACTERS[this.charIdx]!.id);
    this.player.sprite.setDepth(10);

    this.hud = this.add
      .text(12, 84, '', { fontFamily: 'monospace', fontSize: '13px', color: '#e6dcff', backgroundColor: '#140f2bb0', padding: { x: 7, y: 5 } })
      .setDepth(50);

    this.add.text(W / 2, 24, 'FABLE CURRENTS', { fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: '#d8c8ff' }).setOrigin(0.5).setDepth(50);
    this.add.text(W / 2, 46, 'currents as a difficulty dial · power-dive lunge synergy', { fontFamily: FONT, fontSize: '12px', color: '#9d8fc9' }).setOrigin(0.5).setDepth(50);
    this.presetLabel = this.add.text(W / 2, H - 118, '', { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: '#ffd97a' }).setOrigin(0.5).setDepth(50);
    this.noteLabel = this.add.text(W / 2, H - 94, '', { fontFamily: FONT, fontSize: '12.5px', color: '#bfb3e0', align: 'center', wordWrap: { width: 330 } }).setOrigin(0.5, 0).setDepth(50);
    this.charLabel = this.add.text(W / 2, H - 40, '', { fontFamily: FONT, fontSize: '16px', color: '#9fd8cf' }).setOrigin(0.5).setDepth(50);

    makeButton(this, 54, H - 112, '‹', () => this.cyclePreset(-1), { width: 48, height: 42, fontSize: 26, accent: 0x8f6fd6 }).setDepth(50);
    makeButton(this, W - 54, H - 112, '›', () => this.cyclePreset(1), { width: 48, height: 42, fontSize: 26, accent: 0x8f6fd6 }).setDepth(50);
    makeButton(this, 80, H - 40, 'creature ⟳', () => this.cycleChar(), { variant: 'ghost', width: 140, height: 36, fontSize: 15 }).setDepth(50);
    makeButton(this, W - 70, H - 40, 'reset', () => this.resetBody(), { variant: 'ghost', width: 110, height: 36, fontSize: 15 }).setDepth(50);
    makeBackButton(this, '◀ menu', () => this.scene.start('Menu')).setDepth(50);

    this.input.mouse?.disableContextMenu();
    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.keyW = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyS = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S);

    this.buildKnobPanel();
    this.updateLabels();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.viz.destroy();
      this.panel?.remove();
    });
  }

  private rebuild(): void {
    const char = CHARACTERS[this.charIdx]!;
    const eff = deriveEffective(PD.physics, char);
    this.cfg = eff;
    this.massScale = char.massScale;
    this.currentField = FABLE_PRESETS[this.presetIdx]!.build(this.knobs);
    this.bodyField = new CompositeField([
      new ConstantBuoyancyField(eff.buoyancyAccel),
      new HomeSpringField({ homeX: W * 0.35, k: PD.springK * char.massScale * 0.5 }),
      this.currentField,
    ]);
    this.policy = new PowerDivePolicy({
      thrustUp: PD.biaxial.thrustUp * char.thrustScale,
      thrustDown: PD.biaxial.thrustDown * char.thrustScale,
      thrustForward: PD.thrustForward * char.thrustScale,
      attackMs: PD.biaxial.attackMs,
      decayMs: PD.biaxial.decayMs,
    });
  }

  private cyclePreset(dir: number): void {
    this.presetIdx = (this.presetIdx + dir + FABLE_PRESETS.length) % FABLE_PRESETS.length;
    this.applyKnobs();
  }

  private cycleChar(): void {
    this.charIdx = (this.charIdx + 1) % CHARACTERS.length;
    this.rebuild();
    this.player.sprite.setTexture(CHARACTERS[this.charIdx]!.id);
    if (this.anims.exists(`swim-${CHARACTERS[this.charIdx]!.id}`)) {
      this.player.sprite.play(`swim-${CHARACTERS[this.charIdx]!.id}`);
    }
    this.updateLabels();
  }

  private resetBody(): void {
    this.body = createBody(W * 0.35, H / 2);
    this.prev = this.body;
    this.policy.reset();
  }

  private applyKnobs(): void {
    this.rebuild();
    this.viz.setField(this.currentField);
    this.updateLabels();
  }

  private updateLabels(): void {
    const p = FABLE_PRESETS[this.presetIdx]!;
    this.presetLabel.setText(p.name);
    this.noteLabel.setText(p.note);
    this.charLabel.setText(CHARACTERS[this.charIdx]!.name);
  }

  /** The difficulty instrument: live DOM sliders for every knob. */
  private buildKnobPanel(): void {
    const panel = document.createElement('div');
    panel.style.cssText =
      'position:fixed;top:8px;right:8px;z-index:10;background:#140f2be6;color:#e6dcff;' +
      'font:12px monospace;padding:10px 12px;border-radius:8px;width:230px;user-select:none';
    panel.innerHTML = '<b>difficulty knobs — live</b><br/>';
    const KNOB_HELP: Record<string, string> = {
      intensity: 'master current volume',
      assistBias: '−1 kind ocean · +1 spiteful',
      turbulence: 'chaos texture (px/s²)',
      pulsePeriod: 'vent breath (s) — shorter = harder',
      lungeSynergy: 'tailwind × power-dive lunge',
    };
    for (const key of Object.keys(this.knobs) as (keyof FableKnobs)[]) {
      const r = KNOB_RANGES[key];
      const row = document.createElement('div');
      row.style.cssText = 'margin-top:7px';
      const label = document.createElement('div');
      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(r.min);
      input.max = String(r.max);
      input.step = String(r.step);
      input.value = String(this.knobs[key]);
      input.style.width = '100%';
      label.textContent = `${key}: ${this.knobs[key]}`;
      input.oninput = () => {
        this.knobs[key] = Number(input.value);
        label.textContent = `${key}: ${input.value}`;
        this.applyKnobs();
      };
      const help = document.createElement('div');
      help.style.cssText = 'color:#9d8fc9;font-size:10.5px';
      help.textContent = KNOB_HELP[key] ?? '';
      row.append(label, input, help);
      panel.append(row);
    }
    document.body.append(panel);
    this.panel = panel;
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
    let lungeFactor = 1;
    this.accumulator += Math.min(delta / 1000, 0.25);
    while (this.accumulator >= this.cfg.fixedStep) {
      this.accumulator -= this.cfg.fixedStep;
      this.prev = this.body;
      this.policy.setHold(up, down);
      const thrust = this.policy.step(this.cfg.fixedStep);
      // LUNGE SYNERGY: a tailwind at your position multiplies the forward
      // lunge; a headwind saps it. This is the Power-Dive × currents hook —
      // positioning inside the flow becomes the skill.
      if (thrust.dvx > 0) {
        const cur = this.currentField.sampleForce(this.body.x, this.body.y, this.simTime);
        lungeFactor = 1 + this.knobs.lungeSynergy * Math.max(-0.9, Math.min(1, cur.x / 150));
        thrust.dvx *= lungeFactor;
      }
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
        `fps     ${this.game.loop.actualFps.toFixed(0)}`,
        `vel     ${this.body.vx.toFixed(0)}, ${this.body.vy.toFixed(0)} px/s`,
        `current ${f.x.toFixed(0)}, ${f.y.toFixed(0)} px/s²`,
        `lunge   ×${lungeFactor.toFixed(2)}`,
      ].join('\n'),
    );
  }

  private wrap(): void {
    const r = 24;
    if (this.body.x < r) this.body = { ...this.body, x: r, vx: Math.max(0, this.body.vx) };
    if (this.body.x > W - r) this.body = { ...this.body, x: W - r, vx: Math.min(0, this.body.vx) };
    if (this.body.y < r) this.body = { ...this.body, y: r, vy: Math.max(0, this.body.vy) };
    if (this.body.y > H - r) this.body = { ...this.body, y: H - r, vy: Math.min(0, this.body.vy) };
  }
}
