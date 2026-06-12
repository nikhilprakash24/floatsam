import Phaser from 'phaser';
import { transition } from '../core/state/fsm';
import { LocalStorageStore } from '../platform/Storage';
import { BEST_SCORE_KEY } from '../core/score/score';
import { SfxSynth } from '../platform/audio';
import difficulty from '../config/difficulty.json';

const W = difficulty.worldWidth;
const H = difficulty.worldHeight;

/**
 * Generates all placeholder art procedurally (ADR-002): zero downloads,
 * zero licensing, swappable for real sprite sheets later.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.makeSeal();
    this.makeReefColumn();
    this.makeBubble();
    this.makeBackgrounds();
    this.makeDot();
    this.makeLightAndVignette();

    const store = new LocalStorageStore();
    this.registry.set('store', store);
    this.registry.set('best', Number(store.get(BEST_SCORE_KEY) ?? 0));
    this.registry.set('sfx', new SfxSynth(store));
    this.registry.set('appState', transition('BOOT', 'MENU'));

    const params = new URLSearchParams(window.location.search);
    this.scene.start(params.get('scene') === 'sandbox' ? 'Sandbox' : 'Menu');
  }

  private makeSeal(): void {
    const g = this.add.graphics();
    // Tail flippers
    g.fillStyle(0x86a0b0);
    g.fillTriangle(4, 14, 4, 34, 22, 25);
    g.fillTriangle(4, 20, 10, 38, 22, 27);
    // Body
    g.fillStyle(0x9fb8c8);
    g.fillEllipse(36, 25, 54, 30);
    // Head
    g.fillCircle(54, 19, 13);
    // Belly
    g.fillStyle(0xd8e6ee);
    g.fillEllipse(32, 31, 38, 15);
    // Snout
    g.fillStyle(0xc4d6e2);
    g.fillEllipse(62, 23, 11, 8);
    g.fillStyle(0x22333d);
    g.fillCircle(66, 21, 1.8);
    // Eye
    g.fillStyle(0x1c2b33);
    g.fillCircle(55, 15, 2.8);
    g.fillStyle(0xffffff);
    g.fillCircle(56, 14, 1);
    // Front flipper
    g.fillStyle(0x86a0b0);
    g.fillEllipse(36, 37, 16, 7);
    g.generateTexture('seal', 72, 48);
    g.destroy();
  }

  private makeReefColumn(): void {
    const g = this.add.graphics();
    const w = difficulty.pipeWidth;
    // Column body
    g.fillStyle(0x14695e);
    g.fillRect(0, 0, w, H);
    // Edge shading
    g.fillStyle(0x0e4f47);
    g.fillRect(0, 0, 7, H);
    g.fillRect(w - 7, 0, 7, H);
    // Texture striations
    g.fillStyle(0x117063, 0.6);
    for (let y = 60; y < H; y += 90) {
      g.fillEllipse(w / 2, y, w - 18, 22);
    }
    // Cap (gap lip)
    g.fillStyle(0x1d8a77);
    g.fillRoundedRect(0, 0, w, 26, { tl: 8, tr: 8, bl: 0, br: 0 });
    // Coral bumps on the lip
    g.fillStyle(0xe8735a);
    g.fillCircle(14, 7, 5);
    g.fillStyle(0xf29a6b);
    g.fillCircle(34, 5, 6);
    g.fillStyle(0xd95f6a);
    g.fillCircle(54, 7, 5);
    g.generateTexture('reef', w, H);
    g.destroy();
  }

  private makeBubble(): void {
    const g = this.add.graphics();
    g.fillStyle(0xbfe6f2, 0.16);
    g.fillCircle(9, 9, 8);
    g.lineStyle(1.5, 0xbfe6f2, 0.75);
    g.strokeCircle(9, 9, 8);
    g.fillStyle(0xffffff, 0.85);
    g.fillCircle(6, 6, 2);
    g.generateTexture('bubble', 18, 18);
    g.destroy();
  }

  private makeBackgrounds(): void {
    // Far layer: dim rock silhouettes + kelp ribbons.
    const far = this.add.graphics();
    far.fillStyle(0x06303f, 0.85);
    far.fillEllipse(90, H - 18, 200, 110);
    far.fillEllipse(300, H - 10, 260, 90);
    far.fillEllipse(430, H - 30, 160, 140);
    far.fillStyle(0x0a4254, 0.7);
    for (const [x, h, sway] of [
      [60, 300, 14],
      [180, 220, -10],
      [340, 340, 12],
      [440, 200, -8],
    ] as const) {
      for (let i = 0; i < h; i += 18) {
        const off = Math.sin(i / 40) * sway;
        far.fillEllipse(x + off, H - i, 16, 22);
      }
    }
    far.generateTexture('bgFar', W, H);
    far.destroy();

    // Mid layer: brighter kelp, drifting plankton flecks.
    const mid = this.add.graphics();
    mid.fillStyle(0x0e5a64, 0.8);
    for (const [x, h, sway] of [
      [110, 260, 18],
      [260, 180, -14],
      [400, 300, 16],
    ] as const) {
      for (let i = 0; i < h; i += 14) {
        const off = Math.sin(i / 34) * sway;
        mid.fillEllipse(x + off, H - i, 12, 18);
      }
    }
    mid.fillStyle(0x9fd8cf, 0.18);
    for (let i = 0; i < 26; i++) {
      mid.fillCircle(((i * 97) % W + W) % W, (i * 173) % (H - 80), 2);
    }
    mid.generateTexture('bgMid', W, H);
    mid.destroy();

    // Seabed sand strip.
    const sand = this.add.graphics();
    sand.fillStyle(0x6e5f43);
    sand.fillRect(0, 8, W, 40);
    sand.fillStyle(0x8a7a55);
    sand.fillRect(0, 0, W, 12);
    sand.fillStyle(0x9c8b63, 0.6);
    for (let i = 0; i < 14; i++) {
      sand.fillEllipse((i * 137) % W, 10 + ((i * 53) % 28), 26, 6);
    }
    sand.generateTexture('sand', W, 48);
    sand.destroy();
  }

  private makeLightAndVignette(): void {
    // Caustic light shaft: vertical soft beam, additive-blended in-game.
    const ray = this.textures.createCanvas('ray', 140, H);
    if (ray) {
      const ctx = ray.getContext();
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(190,235,255,0.16)');
      g.addColorStop(0.55, 'rgba(190,235,255,0.05)');
      g.addColorStop(1, 'rgba(190,235,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(50, 0);
      ctx.lineTo(90, 0);
      ctx.lineTo(140, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fill();
      ray.refresh();
    }

    // Water-tint vignette: darkened corners, clear center.
    const vig = this.textures.createCanvas('vignette', W, H);
    if (vig) {
      const ctx = vig.getContext();
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
      g.addColorStop(0, 'rgba(3,24,33,0)');
      g.addColorStop(1, 'rgba(3,24,33,0.5)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      vig.refresh();
    }
  }

  private makeDot(): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff);
    g.fillCircle(4, 4, 4);
    g.generateTexture('dot', 8, 8);
    g.destroy();
  }
}
