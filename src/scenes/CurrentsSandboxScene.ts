import Phaser from 'phaser';
import difficulty from '../config/difficulty.json';
import powerJson from '../config/modes/powerdive.json';
import currentsCfg from '../config/currents.json';
import { createBody, stepBody, type FluidBodyState, type FluidPhysicsConfig } from '../core/fluid/FluidBody';
import { ConstantBuoyancyField, type FluidField } from '../core/fluid/FluidField';
import { CompositeField } from '../core/fluid/fields/CompositeField';
import { CurrentSpawner, ScrollingCurrentField } from '../core/fluid/currents/CurrentSpawner';
import { HELPFUL_KINDS, type CellKind } from '../core/fluid/currents/cells';
import { SurgeScheduler, SurgeField, type SurgeConfig } from '../core/fluid/currents/Surge';
import { BiAxialPolicy } from '../core/input/BiAxialPolicy';
import { CHARACTERS, OTTER, deriveEffective } from '../core/character/CharacterProfile';
import { createRng } from '../core/rng';
import { PlayerView } from '../entities/PlayerView';
import { makeBackButton } from '../ui/Button';

const W = difficulty.worldWidth;
const H = difficulty.worldHeight;
const FONT = '"Trebuchet MS", sans-serif';
const DIVE = powerJson as {
  physics: FluidPhysicsConfig;
  biaxial: { thrustUp: number; thrustDown: number; attackMs: number; decayMs: number };
};
const KINDS = currentsCfg.cells.kinds as CellKind[];
const FLOW: Record<CellKind, [number, number]> = {
  updraft: [0, -1], geyser: [0, -1], 'launch-ramp': [0, -1],
  downwash: [0, 1], crosscut: [1, 0], tailwind: [1, 0], headwind: [-1, 0],
  sidewinder: [0.7, 0.7], boil: [0, 0], drain: [0, 0], 'eddy-cw': [0, 0], 'eddy-ccw': [0, 0],
};

/**
 * CURRENTS SANDBOX (currents program C6) — every design fork as a live knob.
 * Free-swim a creature while the real scrolling cell system streams past, and
 * tune intensity, density (spacing), and the rare Surge on the fly. Same core
 * classes the game uses (CurrentSpawner / ScrollingCurrentField / Surge), so
 * what you feel here is what ships. Dev/testing surface.
 */
export class CurrentsSandboxScene extends Phaser.Scene {
  private body!: FluidBodyState;
  private prev!: FluidBodyState;
  private bodyField!: FluidField;
  private policy!: BiAxialPolicy;
  private cfg!: FluidPhysicsConfig;
  private massScale = 1;
  private charIdx = 0;
  private player!: PlayerView;
  private spawner!: CurrentSpawner;
  private surgeSched?: SurgeScheduler;
  private telegraph!: Phaser.GameObjects.Graphics;
  private surgeCue!: Phaser.GameObjects.Rectangle;
  private hud!: Phaser.GameObjects.Text;
  private panel?: HTMLDivElement;
  private accumulator = 0;
  private simTime = 0;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;

  // Live knobs (the forks).
  private intensity = currentsCfg.cells.intensity;
  private spacing = currentsCfg.cells.spacing;
  private surgeOn = false;
  private surgeEvery = 12;
  private scroll = 150;

  constructor() {
    super('CurrentsSandbox');
  }

  create(): void {
    this.add.rectangle(W / 2, H / 2, W, H, 0x062430).setDepth(0);
    this.add.tileSprite(W / 2, H / 2, W, H, 'bgMid').setDepth(0).setAlpha(0.3);

    this.body = createBody(W * 0.28, H / 2);
    this.prev = this.body;
    this.telegraph = this.add.graphics().setDepth(2);
    this.surgeCue = this.add.rectangle(W / 2, H / 2, W, H, 0x1a3a2a).setDepth(6).setAlpha(0);
    this.rebuild();
    this.player = new PlayerView(this, this.body.x, this.body.y, CHARACTERS[this.charIdx]!.id);
    this.player.sprite.setDepth(10);

    this.hud = this.add
      .text(12, 92, '', { fontFamily: 'monospace', fontSize: '13px', color: '#d8f3ff', backgroundColor: '#06222db0', padding: { x: 7, y: 5 } })
      .setDepth(50);
    this.add.text(W / 2, 22, 'CURRENTS SANDBOX', { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#bfe9f2' }).setOrigin(0.5).setDepth(50);
    this.add.text(W / 2, H - 16, 'rise: top / left-click / ↑    dive+lunge: bottom / right-click / ↓', { fontFamily: FONT, fontSize: '12px', color: '#7fb0c0' }).setOrigin(0.5).setDepth(50);
    makeBackButton(this, '◀ menu', () => this.scene.start('Menu')).setDepth(50);

    this.input.mouse?.disableContextMenu();
    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.keyW = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyS = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S);

    this.buildPanel();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.panel?.remove());
  }

  /** (Re)build the spawner + field stack from the current knobs. */
  private rebuild(): void {
    const char = CHARACTERS[this.charIdx]!;
    const eff = deriveEffective(DIVE.physics, char);
    this.cfg = eff;
    this.massScale = char.massScale;
    this.policy = new BiAxialPolicy({
      thrustUp: DIVE.biaxial.thrustUp * char.thrustScale,
      thrustDown: DIVE.biaxial.thrustDown * char.thrustScale,
      attackMs: DIVE.biaxial.attackMs,
      decayMs: DIVE.biaxial.decayMs,
    });
    this.spawner = new CurrentSpawner(
      { worldW: W, worldH: H, spacing: this.spacing, intensity: this.intensity, kinds: KINDS, firstX: W + 120, marginY: currentsCfg.cells.marginY },
      createRng(1234),
    );
    const B = currentsCfg.budgets;
    const tUp = DIVE.biaxial.thrustUp * OTTER.thrustScale;
    const tDown = DIVE.biaxial.thrustDown * OTTER.thrustScale;
    let extra: SurgeField | undefined;
    if (this.surgeOn) {
      const sc: SurgeConfig = { ...(currentsCfg.surge as SurgeConfig), everySecMin: this.surgeEvery, everySecMax: this.surgeEvery };
      this.surgeSched = new SurgeScheduler(sc, createRng(77));
      extra = new SurgeField(this.surgeSched, currentsCfg.surge.intensity);
    } else {
      this.surgeSched = undefined;
    }
    const scroll = new ScrollingCurrentField(this.spawner, tUp * B.upFrac, tDown * B.downFrac, tUp * B.latFrac, extra);
    this.bodyField = new CompositeField([new ConstantBuoyancyField(eff.buoyancyAccel), scroll]);
  }

  private pollHold(): { up: boolean; down: boolean } {
    let up = this.cursors.up.isDown || this.keyW.isDown;
    let down = this.cursors.down.isDown || this.keyS.isDown;
    const ptr = this.input.activePointer;
    if (ptr.isDown) {
      if (ptr.wasTouch) { if (ptr.worldY < H / 2) up = true; else down = true; }
      else { if (ptr.leftButtonDown()) up = true; if (ptr.rightButtonDown()) down = true; }
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
      this.spawner.update(this.cfg.fixedStep, this.scroll);
      this.surgeSched?.update(this.cfg.fixedStep);
      this.wrap();
    }
    const a = this.accumulator / this.cfg.fixedStep;
    const x = this.prev.x + (this.body.x - this.prev.x) * a;
    const y = this.prev.y + (this.body.y - this.prev.y) * a;
    this.player.update(x, y, this.body.vy, 130);
    this.drawTelegraph();
    this.surgeCue.setAlpha((this.surgeSched?.ramp ?? 0) * 0.22);

    const f = this.bodyField.sampleForce(this.body.x, this.body.y, this.simTime);
    this.hud.setText(
      [
        `fps    ${this.game.loop.actualFps.toFixed(0)}`,
        `cells  ${this.spawner.cells.length}`,
        `force  ${f.x.toFixed(0)}, ${f.y.toFixed(0)} px/s²`,
        `surge  ${(this.surgeSched?.ramp ?? 0).toFixed(2)}`,
      ].join('\n'),
    );
  }

  private drawTelegraph(): void {
    const g = this.telegraph;
    g.clear();
    for (const c of this.spawner.cells) {
      if (c.worldX < -c.halfWidth || c.worldX > W + c.halfWidth) continue;
      const helpful = HELPFUL_KINDS.includes(c.kind);
      const col = helpful ? 0x54d0aa : 0xff8a6b;
      const rw = c.halfWidth * 1.5;
      const rh = Math.min(320, c.halfWidth * 2.1);
      g.fillStyle(col, 0.1);
      g.fillEllipse(c.worldX, c.centerY, rw * 2, rh * 2);
      g.lineStyle(2, col, 0.45);
      g.strokeEllipse(c.worldX, c.centerY, rw * 2, rh * 2);
      const [dx, dy] = FLOW[c.kind];
      if (dx === 0 && dy === 0) {
        g.lineStyle(2.5, col, 0.7);
        g.strokeCircle(c.worldX, c.centerY, 16);
      } else {
        const ex = c.worldX + dx * 26;
        const ey = c.centerY + dy * 26;
        g.lineStyle(3, col, 0.8);
        g.lineBetween(c.worldX - dx * 26, c.centerY - dy * 26, ex, ey);
        g.lineBetween(ex, ey, ex - dx * 9 - dy * 7, ey - dy * 9 + dx * 7);
        g.lineBetween(ex, ey, ex - dx * 9 + dy * 7, ey - dy * 9 - dx * 7);
      }
    }
  }

  private wrap(): void {
    const r = 24;
    if (this.body.x < r) this.body = { ...this.body, x: r, vx: Math.max(0, this.body.vx) };
    if (this.body.x > W - r) this.body = { ...this.body, x: W - r, vx: Math.min(0, this.body.vx) };
    if (this.body.y < r) this.body = { ...this.body, y: r, vy: Math.max(0, this.body.vy) };
    if (this.body.y > H - r) this.body = { ...this.body, y: H - r, vy: Math.min(0, this.body.vy) };
  }

  private buildPanel(): void {
    const panel = document.createElement('div');
    panel.style.cssText =
      'position:fixed;top:8px;right:8px;z-index:10;background:#06303fd9;color:#d8f3ff;' +
      'font:12px monospace;padding:10px 12px;border-radius:8px;width:210px;user-select:none';
    panel.innerHTML = '<b>currents — live forks</b><br/>';
    const slider = (label: string, min: number, max: number, step: number, val: number, onChange: (v: number) => void): void => {
      const row = document.createElement('div');
      row.style.cssText = 'margin-top:7px';
      const lab = document.createElement('div');
      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(min); input.max = String(max); input.step = String(step); input.value = String(val);
      input.style.width = '100%';
      const fmt = (v: number) => (step < 1 ? v.toFixed(2) : String(v));
      lab.textContent = `${label}: ${fmt(val)}`;
      input.oninput = () => { const v = Number(input.value); lab.textContent = `${label}: ${fmt(v)}`; onChange(v); };
      row.append(lab, input);
      panel.append(row);
    };
    slider('intensity', 0, 1.6, 0.05, this.intensity, (v) => { this.intensity = v; this.rebuild(); });
    slider('spacing (density)', 140, 520, 10, this.spacing, (v) => { this.spacing = v; this.rebuild(); });
    slider('surge every (s)', 4, 40, 1, this.surgeEvery, (v) => { this.surgeEvery = v; if (this.surgeOn) this.rebuild(); });

    const surgeRow = document.createElement('label');
    surgeRow.style.cssText = 'display:block;margin-top:8px;cursor:pointer';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = this.surgeOn;
    cb.onchange = () => { this.surgeOn = cb.checked; this.rebuild(); };
    surgeRow.append(cb, document.createTextNode(' rare Surge (whole-screen)'));
    panel.append(surgeRow);

    const charBtn = document.createElement('button');
    charBtn.textContent = 'cycle creature';
    charBtn.style.cssText = 'margin-top:9px;width:100%;padding:5px;background:#0e5566;color:#d8f3ff;border:0;border-radius:5px;cursor:pointer';
    charBtn.onclick = () => {
      this.charIdx = (this.charIdx + 1) % CHARACTERS.length;
      this.rebuild();
      this.player.sprite.setTexture(CHARACTERS[this.charIdx]!.id);
    };
    panel.append(charBtn);

    document.body.append(panel);
    this.panel = panel;
  }
}
