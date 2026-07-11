import Phaser from 'phaser';
import { transition } from '../core/state/fsm';
import { LocalStorageStore } from '../platform/Storage';
import { BEST_SCORE_KEY, bestKeyFor } from '../core/score/score';
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
    for (const f of [0, 1] as const) {
      this.makeSeal(f);
      this.makeOtter(f);
      this.makePuffer(f);
      this.makeSeaLion(f);
    }
    // A6: two-frame yoyo swim cycles, one per creature (global anim registry).
    for (const id of ['seal', 'otter', 'puffer', 'sealion']) {
      this.anims.create({
        key: `swim-${id}`,
        frames: [{ key: id }, { key: `${id}-f1` }],
        frameRate: 4.5,
        repeat: -1,
        yoyo: true,
      });
    }
    this.makeReefColumn();
    this.makeBubble();
    this.makeBackgrounds();
    this.makeDot();
    this.makeLightAndVignette();
    this.makeDepthAndShimmer();
    this.makeSeamounts();
    this.makeWhale();

    const store = new LocalStorageStore();
    this.registry.set('store', store);
    // F-4 (v0.6.1): one-time migration — the pre-roster best (single key)
    // becomes the Classic(Seal) best in the keyed system, never overwriting
    // a newer keyed record.
    const legacyBest = store.get(BEST_SCORE_KEY);
    const sealKey = bestKeyFor('classic', 'seal');
    if (legacyBest && !store.get(sealKey)) store.set(sealKey, legacyBest);
    this.registry.set('best', Number(store.get(sealKey) ?? 0));
    this.registry.set('sfx', new SfxSynth(store));
    this.registry.set('appState', transition('BOOT', 'MENU'));
    // Default selection until the player picks (v3.3 §1).
    this.registry.set('modeId', 'classic');
    this.registry.set('characterId', 'seal');
    this.registry.set('pace', 1);
    this.registry.set('paceId', 'base');

    // Deep-link params: ?mode=&character=&pace= preselect; ?play=1 skips the
    // menus (e2e + shareable links); ?scene= jumps to any screen (docs shots).
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode')) this.registry.set('modeId', params.get('mode'));
    if (params.get('character')) this.registry.set('characterId', params.get('character'));

    const SCENES: Record<string, string> = {
      sandbox: 'Sandbox',
      lab: 'Lab',
      fable: 'FableLab',
      catalog: 'Catalog',
      'currents-sandbox': 'CurrentsSandbox',
      pace: 'PaceSelect',
      mode: 'ModeSelect',
      character: 'CharacterSelect',
    };
    const target = SCENES[params.get('scene') ?? ''];
    if (target) this.scene.start(target);
    else if (params.get('play') === '1') this.scene.start('Game');
    else this.scene.start('Menu');
  }

  /** A6: each creature gets two swim frames (f=0/1) → a yoyo swim cycle. */
  private makeSeal(f: 0 | 1): void {
    const g = this.add.graphics();
    const t = f === 1 ? -7 : 0; // tail sweep
    const p = f === 1 ? -4 : 0; // front-flipper stroke
    // Tail flippers
    g.fillStyle(0x86a0b0);
    g.fillTriangle(4, 14 + t, 4, 34 + t, 22, 25);
    g.fillTriangle(4, 20 + t, 10, 38 + t, 22, 27);
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
    g.fillEllipse(36, 37 + p, 16, 7);
    g.generateTexture(f === 0 ? 'seal' : 'seal-f1', 72, 48);
    g.destroy();
  }

  /** Otter: smaller, sleeker, brown — light·agile·weak-flap (v3.3 roster). */
  private makeOtter(f: 0 | 1): void {
    const g = this.add.graphics();
    const t = f === 1 ? -8 : 0; // quick tail flick
    const p = f === 1 ? -3 : 0; // paw stroke
    // Tail (longer, tapered)
    g.fillStyle(0x6e5639);
    g.fillTriangle(2, 18 + t, 2, 30 + t, 20, 24);
    // Body (slimmer than the seal)
    g.fillStyle(0x8a6f4a);
    g.fillEllipse(34, 24, 50, 24);
    // Head
    g.fillCircle(52, 20, 11);
    // Belly
    g.fillStyle(0xc7ad86);
    g.fillEllipse(31, 29, 34, 11);
    // Muzzle
    g.fillStyle(0xa98a5e);
    g.fillEllipse(59, 22, 10, 7);
    // Nose
    g.fillStyle(0x2a2018);
    g.fillCircle(63, 21, 2);
    // Ears
    g.fillStyle(0x6e5639);
    g.fillCircle(47, 12, 3);
    g.fillCircle(55, 11, 3);
    // Eye
    g.fillStyle(0x1c140d);
    g.fillCircle(53, 16, 2.6);
    g.fillStyle(0xffffff);
    g.fillCircle(54, 15, 0.9);
    // Front paw
    g.fillStyle(0x6e5639);
    g.fillEllipse(34, 35 + p, 14, 6);
    g.generateTexture(f === 0 ? 'otter' : 'otter-f1', 68, 44);
    g.destroy();
  }

  /** Sea Lion: large, dark, eared — heavy·powerful bruiser (v3.3 roster). */
  private makeSeaLion(f: 0 | 1): void {
    const g = this.add.graphics();
    const t = f === 1 ? -9 : 0; // powerful tail drive
    const p = f === 1 ? -5 : 0;
    // Hind flippers
    g.fillStyle(0x5a4632);
    g.fillTriangle(3, 13 + t, 3, 39 + t, 24, 26);
    g.fillTriangle(3, 22 + t, 12, 42 + t, 24, 28);
    // Bulky body
    g.fillStyle(0x6f5740);
    g.fillEllipse(38, 26, 60, 34);
    // Thick neck + head
    g.fillCircle(58, 19, 15);
    // Belly
    g.fillStyle(0x8a7259);
    g.fillEllipse(34, 33, 42, 16);
    // Long snout
    g.fillStyle(0x5f4a36);
    g.fillEllipse(68, 22, 14, 9);
    g.fillStyle(0x1a120b);
    g.fillCircle(73, 20, 2.2);
    // External ear flaps (the sea-lion tell)
    g.fillStyle(0x4f3d2b);
    g.fillEllipse(52, 9, 5, 9);
    // Whisker brow
    g.fillStyle(0x1a120b);
    g.fillCircle(59, 14, 3.2);
    g.fillStyle(0xffffff);
    g.fillCircle(60, 13, 1.1);
    // Front flipper (large)
    g.fillStyle(0x5a4632);
    g.fillEllipse(40, 40 + p, 22, 9);
    g.generateTexture(f === 0 ? 'sealion' : 'sealion-f1', 84, 52);
    g.destroy();
  }

  /** Puffer: big, round, spiky — heavy·floaty·wide (v3.3 roster). */
  private makePuffer(f: 0 | 1): void {
    const g = this.add.graphics();
    const cx = 40;
    const cy = 40;
    const puff = f === 1 ? 2.5 : 0; // frame 1: puffed up
    // Spikes radiating out.
    g.fillStyle(0xc77f3a);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const bx = cx + Math.cos(a) * (26 + puff);
      const by = cy + Math.sin(a) * (26 + puff);
      const tx = cx + Math.cos(a) * (36 + puff);
      const ty = cy + Math.sin(a) * (36 + puff);
      const px = Math.cos(a + 0.18) * 5;
      const py = Math.sin(a + 0.18) * 5;
      g.fillTriangle(bx - px, by - py, bx + px, by + py, tx, ty);
    }
    // Round body
    g.fillStyle(0xe0954b);
    g.fillCircle(cx, cy, 27 + puff);
    // Belly
    g.fillStyle(0xf5dcb0);
    g.fillEllipse(cx - 2, cy + 7, 38, 24);
    // Spots
    g.fillStyle(0xc77f3a, 0.7);
    g.fillCircle(cx - 12, cy - 8, 3);
    g.fillCircle(cx + 6, cy - 12, 2.5);
    g.fillCircle(cx + 14, cy + 2, 3);
    // Cheeks
    g.fillStyle(0xf0a86a);
    g.fillCircle(cx + 16, cy + 8, 6);
    // Eyes
    g.fillStyle(0xffffff);
    g.fillCircle(cx + 9, cy - 4, 6);
    g.fillCircle(cx + 21, cy - 3, 5);
    g.fillStyle(0x1c140d);
    g.fillCircle(cx + 11, cy - 3, 2.6);
    g.fillCircle(cx + 22, cy - 2, 2.3);
    // Tiny mouth
    g.fillStyle(0x8a4a22);
    g.fillEllipse(cx + 22, cy + 9, 6, 4);
    g.generateTexture(f === 0 ? 'puffer' : 'puffer-f1', 80, 80);
    g.destroy();
  }

  /** Three reef palettes/coral layouts — swapped per gate recycle (A2). */
  private makeReefColumn(): void {
    const w = difficulty.pipeWidth;
    const VARIANTS = [
      { body: 0x14695e, edge: 0x0e4f47, stria: 0x117063, cap: 0x1d8a77, corals: [[14, 7, 5, 0xe8735a], [34, 5, 6, 0xf29a6b], [54, 7, 5, 0xd95f6a]] },
      { body: 0x11606a, edge: 0x0b4650, stria: 0x146d78, cap: 0x1a8c94, corals: [[12, 6, 4, 0xf2b06b], [30, 8, 5, 0xe8735a], [48, 5, 4, 0xf2d76b], [60, 8, 4, 0xd95f6a]] },
      { body: 0x186653, edge: 0x104a3c, stria: 0x1d7a5e, cap: 0x27a077, corals: [[18, 6, 6, 0xd95f8a], [42, 7, 5, 0xf29a6b], [58, 5, 4, 0xe8735a]] },
    ] as const;

    VARIANTS.forEach((v, i) => {
      const g = this.add.graphics();
      g.fillStyle(v.body);
      g.fillRect(0, 0, w, H);
      g.fillStyle(v.edge);
      g.fillRect(0, 0, 7, H);
      g.fillRect(w - 7, 0, 7, H);
      g.fillStyle(v.stria, 0.6);
      for (let y = 60 + i * 24; y < H; y += 82 + i * 10) {
        g.fillEllipse(w / 2, y, w - 18, 22);
      }
      // Barnacle specks for texture
      g.fillStyle(0xffffff, 0.08);
      for (let k = 0; k < 26; k++) {
        g.fillCircle(9 + ((k * 37 + i * 13) % (w - 18)), (k * 53 + i * 29) % H, 2);
      }
      g.fillStyle(v.cap);
      g.fillRoundedRect(0, 0, w, 26, { tl: 8, tr: 8, bl: 0, br: 0 });
      for (const [cx, cy, r, col] of v.corals) {
        g.fillStyle(col);
        g.fillCircle(cx, cy, r);
      }
      g.generateTexture(`reef${i}`, w, H);
      g.destroy();
    });
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

  /** A1: vertical depth gradient (bright surface → abyss) + surface shimmer. */
  private makeDepthAndShimmer(): void {
    const grad = this.textures.createCanvas('bgGradient', W, H);
    if (grad) {
      const ctx = grad.getContext();
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#1a6b82');
      g.addColorStop(0.28, '#0f4a5f');
      g.addColorStop(0.65, '#0b3d4f');
      g.addColorStop(1, '#041e2a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      grad.refresh();
    }

    const shim = this.textures.createCanvas('shimmer', W, 30);
    if (shim) {
      const ctx = shim.getContext();
      const g = ctx.createLinearGradient(0, 0, 0, 30);
      g.addColorStop(0, 'rgba(214,242,255,0.55)');
      g.addColorStop(0.5, 'rgba(160,220,240,0.18)');
      g.addColorStop(1, 'rgba(160,220,240,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, 30);
      // Broken highlight streaks so it reads as light on water, not a bar.
      ctx.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 22; i++) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect((i * 43) % W, 0, 12 + ((i * 17) % 14), 8);
      }
      shim.refresh();
    }
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

  /**
   * Distant seamounts — three receding silhouette ridges with underwater
   * atmospheric perspective (far = hazier, bluer, fainter). Replaces the
   * caustic light shafts. Built from integer-frequency sines so the texture
   * tiles seamlessly and can parallax-scroll (2× width for a longer loop).
   */
  private makeSeamounts(): void {
    const TW = W * 2;
    const cv = this.textures.createCanvas('seamounts', TW, H);
    if (!cv) return;
    const ctx = cv.getContext();

    const ridge = (baseY: number, amp: number, fill: string, seed: number): void => {
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= TW; x++) {
        const t = x / TW;
        const n =
          0.5 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 2 * t + seed)) +
          0.3 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 4 * t + seed * 1.7)) +
          0.2 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 6 * t + seed * 2.6));
        ctx.lineTo(x, baseY - amp * n);
      }
      ctx.lineTo(TW, H);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    };

    // far → near: back ridge fades toward the water haze; front reads darker.
    ridge(H * 0.56, 150, 'rgba(41, 104, 126, 0.36)', 0.6);
    ridge(H * 0.68, 185, 'rgba(24, 82, 103, 0.52)', 2.1);
    ridge(H * 0.82, 240, 'rgba(11, 54, 70, 0.78)', 3.9);
    cv.refresh();
  }

  /**
   * Distant whale silhouette (facing left) for the rare background fly-by.
   * A humpback gestalt from overlapping ellipses + fluke/pectoral triangles —
   * read at low alpha and far depth, so a recognizable shape is all it needs.
   */
  private makeWhale(): void {
    const g = this.add.graphics();
    g.fillStyle(0x0a3547, 1);
    // Long tapered body + broad head (left).
    g.fillEllipse(102, 44, 168, 46);
    g.fillEllipse(46, 46, 84, 40);
    // Tail stock narrowing to the flukes (right).
    g.fillTriangle(160, 30, 160, 58, 198, 44);
    // Horizontal tail flukes.
    g.fillTriangle(186, 44, 210, 20, 202, 46);
    g.fillTriangle(186, 44, 210, 68, 202, 46);
    // Long humpback pectoral fin, angled down-forward.
    g.fillTriangle(80, 56, 52, 86, 104, 62);
    // Faint jaw line hint.
    g.fillStyle(0x061f2b, 0.6);
    g.fillEllipse(40, 56, 60, 8);
    // Tiny eye highlight.
    g.fillStyle(0x9fd8cf, 0.5);
    g.fillCircle(28, 40, 2);
    g.generateTexture('whale', 214, 92);
    g.destroy();
  }

  private makeDot(): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff);
    g.fillCircle(4, 4, 4);
    g.generateTexture('dot', 8, 8);
    g.destroy();
  }
}
