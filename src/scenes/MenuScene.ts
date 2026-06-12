import Phaser from 'phaser';
import difficulty from '../config/difficulty.json';
import type { SfxSynth } from '../platform/audio';

const W = difficulty.worldWidth;
const H = difficulty.worldHeight;
const FONT = '"Trebuchet MS", sans-serif';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    this.add.tileSprite(W / 2, H / 2, W, H, 'bgFar');
    this.add.tileSprite(W / 2, H / 2, W, H, 'bgMid');
    this.add.image(W / 2, H - 24, 'sand');

    this.add
      .text(W / 2, H * 0.22, 'UNDERWATER\nFLAPPY', {
        fontFamily: FONT,
        fontSize: '52px',
        fontStyle: 'bold',
        color: '#e8f6fb',
        align: 'center',
        stroke: '#0a2e3d',
        strokeThickness: 8,
      })
      .setOrigin(0.5);

    const seal = this.add.image(W / 2, H * 0.45, 'seal').setScale(1.6);
    this.tweens.add({
      targets: seal,
      y: H * 0.45 + 16,
      angle: 4,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.add.particles(0, 0, 'bubble', {
      x: { min: 40, max: W - 40 },
      y: H + 20,
      speedY: { min: -45, max: -20 },
      scale: { start: 0.4, end: 0.8 },
      alpha: { start: 0.5, end: 0 },
      lifespan: 6000,
      frequency: 600,
    });

    const start = this.add
      .text(W / 2, H * 0.66, 'tap to dive', {
        fontFamily: FONT,
        fontSize: '30px',
        color: '#ffd97a',
        stroke: '#0a2e3d',
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: start, alpha: 0.4, duration: 650, yoyo: true, repeat: -1 });

    const best = this.registry.get('best') as number;
    this.add
      .text(W / 2, H * 0.74, `best: ${best}`, {
        fontFamily: FONT,
        fontSize: '22px',
        color: '#bfdde8',
      })
      .setOrigin(0.5);

    const sfx = this.registry.get('sfx') as SfxSynth;
    const mute = this.add
      .text(14, 14, sfx.isMuted() ? '🔇' : '🔊', { fontSize: '24px' })
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    mute.on(
      'pointerdown',
      (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation();
        sfx.unlock();
        mute.setText(sfx.toggleMute() ? '🔇' : '🔊');
      },
    );

    // GameScene.create owns the →PLAY transition.
    this.input.once('pointerdown', () => this.scene.start('Game'));

    // Physics sandbox entry (Phase 1 tooling, kept for tuning sessions).
    this.add
      .text(W - 12, H - 10, 'sandbox', {
        fontFamily: FONT,
        fontSize: '15px',
        color: '#7fa8b8',
      })
      .setOrigin(1, 1)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation();
        this.scene.start('Sandbox');
      });
  }
}
