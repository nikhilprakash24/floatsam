import Phaser from 'phaser';
import difficulty from '../config/difficulty.json';
import diveJson from '../config/modes/dive.json';
import { createBody, stepBody, type FluidBodyState, type FluidPhysicsConfig } from '../core/fluid/FluidBody';
import { ConstantBuoyancyField, type FluidField } from '../core/fluid/FluidField';
import { CompositeField } from '../core/fluid/fields/CompositeField';
import { CURRENT_CATALOG, type CurrentPattern } from '../core/fluid/currents/catalog';
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

const DISPOSITION_COLOR: Record<string, string> = {
  helpful: '#7ce0a6',
  hostile: '#ff8a6b',
  neutral: '#bfdde8',
};

/**
 * CURRENTS CATALOG — the expanded Currents Lab (currents program C2). Browse all
 * 20 catalog patterns, free-swim through each with the flow visualized, and dial
 * `intensity` live (the sandbox knob). One pattern = one FluidField from the pure
 * catalog; this scene is just a viewer, so it stays a dev/testing surface.
 */
export class CatalogScene extends Phaser.Scene {
  private idx = 0;
  private intensity = 1;
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
  private nameLabel!: Phaser.GameObjects.Text;
  private noteLabel!: Phaser.GameObjects.Text;
  private tagLabel!: Phaser.GameObjects.Text;
  private panel?: HTMLDivElement;
  private accumulator = 0;
  private simTime = 0;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;

  constructor() {
    super('Catalog');
  }

  create(): void {
    this.add.rectangle(W / 2, H / 2, W, H, 0x062430).setDepth(0);
    this.add.tileSprite(W / 2, H / 2, W, H, 'bgMid').setDepth(0).setAlpha(0.3);

    this.body = createBody(W / 2, H / 2);
    this.prev = this.body;
    this.rebuild();

    this.viz = new FieldVisualizer(this, this.currentField, W, H);
    this.player = new PlayerView(this, this.body.x, this.body.y, CHARACTERS[this.charIdx]!.id);
    this.player.sprite.setDepth(10);

    this.hud = this.add
      .text(12, 108, '', { fontFamily: 'monospace', fontSize: '13px', color: '#d8f3ff', backgroundColor: '#06222db0', padding: { x: 7, y: 5 } })
      .setDepth(50);

    this.add.text(W / 2, 22, 'CURRENTS CATALOG', { fontFamily: FONT, fontSize: '23px', fontStyle: 'bold', color: '#bfe9f2' }).setOrigin(0.5).setDepth(50);
    this.nameLabel = this.add.text(W / 2, H - 118, '', { fontFamily: FONT, fontSize: '21px', fontStyle: 'bold', color: '#ffd97a' }).setOrigin(0.5).setDepth(50);
    this.tagLabel = this.add.text(W / 2, H - 94, '', { fontFamily: FONT, fontSize: '14px', color: '#9fd8cf' }).setOrigin(0.5).setDepth(50);
    this.noteLabel = this.add.text(W / 2, H - 70, '', { fontFamily: FONT, fontSize: '14px', color: '#cfe9f2', align: 'center', wordWrap: { width: W - 130 } }).setOrigin(0.5).setDepth(50);

    makeButton(this, 46, H - 108, '‹', () => this.cycle(-1), { width: 48, height: 42, fontSize: 26, accent: 0x4aa3e0 }).setDepth(50);
    makeButton(this, W - 46, H - 108, '›', () => this.cycle(1), { width: 48, height: 42, fontSize: 26, accent: 0x4aa3e0 }).setDepth(50);
    makeButton(this, 80, H - 34, 'creature ⟳', () => this.cycleChar(), { variant: 'ghost', width: 140, height: 34, fontSize: 15 }).setDepth(50);
    makeButton(this, W - 66, H - 34, 'reset', () => this.resetBody(), { variant: 'ghost', width: 104, height: 34, fontSize: 15 }).setDepth(50);

    makeBackButton(this, '◀ menu', () => this.scene.start('Menu')).setDepth(50);

    this.input.mouse?.disableContextMenu();
    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.keyW = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyS = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S);

    this.buildPanel();
    this.updateLabels();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.viz.destroy();
      this.panel?.remove();
    });
  }

  private pattern(): CurrentPattern {
    return CURRENT_CATALOG[this.idx]!;
  }

  private rebuild(): void {
    const char = CHARACTERS[this.charIdx]!;
    const eff = deriveEffective(DIVE.physics, char);
    this.cfg = eff;
    this.massScale = char.massScale;
    this.currentField = this.pattern().build({ intensity: this.intensity });
    this.bodyField = new CompositeField([new ConstantBuoyancyField(eff.buoyancyAccel), this.currentField]);
    this.policy = new BiAxialPolicy({
      thrustUp: DIVE.biaxial.thrustUp * char.thrustScale,
      thrustDown: DIVE.biaxial.thrustDown * char.thrustScale,
      attackMs: DIVE.biaxial.attackMs,
      decayMs: DIVE.biaxial.decayMs,
    });
  }

  private cycle(dir: number): void {
    this.idx = (this.idx + dir + CURRENT_CATALOG.length) % CURRENT_CATALOG.length;
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
    const p = this.pattern();
    this.nameLabel.setText(`#${p.n}  ${p.name}`);
    this.tagLabel
      .setText(`${p.shape}  ·  ${p.disposition}  ·  ${p.game}`)
      .setColor(DISPOSITION_COLOR[p.disposition] ?? '#9fd8cf');
    this.noteLabel.setText(p.note);
  }

  private buildPanel(): void {
    const panel = document.createElement('div');
    panel.style.cssText =
      'position:fixed;top:8px;right:8px;z-index:10;background:#06303fd9;color:#d8f3ff;' +
      'font:12px monospace;padding:10px 12px;border-radius:8px;width:190px;user-select:none';
    panel.innerHTML = '<b>catalog knobs</b><br/>';
    const row = document.createElement('div');
    row.style.cssText = 'margin-top:7px';
    const label = document.createElement('div');
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = '1.6';
    input.step = '0.05';
    input.value = String(this.intensity);
    input.style.width = '100%';
    label.textContent = `intensity: ${this.intensity.toFixed(2)}`;
    input.oninput = () => {
      this.intensity = Number(input.value);
      label.textContent = `intensity: ${this.intensity.toFixed(2)}`;
      this.rebuild();
      this.viz.setField(this.currentField);
    };
    row.append(label, input);
    panel.append(row);
    const hint = document.createElement('div');
    hint.style.cssText = 'margin-top:8px;color:#8fc3d4';
    hint.textContent = '‹ › browse 20 patterns · session-only';
    panel.append(hint);
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
        `fps     ${this.game.loop.actualFps.toFixed(0)}`,
        `vel     ${this.body.vx.toFixed(0)}, ${this.body.vy.toFixed(0)} px/s`,
        `current ${f.x.toFixed(0)}, ${f.y.toFixed(0)} px/s²`,
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
