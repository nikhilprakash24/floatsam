import Phaser from 'phaser';
import difficulty from '../config/difficulty.json';
import type { SfxSynth } from '../platform/audio';
import { prefersReducedMotion } from '../platform/motion';
import { makeButton } from '../ui/Button';

const W = difficulty.worldWidth;
const H = difficulty.worldHeight;
const FONT = '"Trebuchet MS", sans-serif';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    this.add.image(W / 2, H / 2, 'bgGradient');
    this.add.tileSprite(W / 2, H / 2, W, H, 'bgFar');
    this.add.tileSprite(W / 2, H / 2, W, H, 'bgMid');
    this.add.image(W / 2, H - 24, 'sand');

    this.add
      .text(W / 2, H * 0.18, 'UNDERWATER\nFLAPPY', {
        fontFamily: FONT,
        fontSize: '50px',
        fontStyle: 'bold',
        color: '#e8f6fb',
        align: 'center',
        stroke: '#0a2e3d',
        strokeThickness: 8,
      })
      .setOrigin(0.5);

    const seal = this.add.image(W / 2, H * 0.4, 'seal').setScale(1.6);
    if (!prefersReducedMotion()) {
      this.tweens.add({
        targets: seal,
        y: H * 0.4 + 16,
        angle: 4,
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    this.add.particles(0, 0, 'bubble', {
      x: { min: 40, max: W - 40 },
      y: H + 20,
      speedY: { min: -45, max: -20 },
      scale: { start: 0.4, end: 0.8 },
      alpha: { start: 0.5, end: 0 },
      lifespan: 6000,
      frequency: 600,
    });

    // Primary actions.
    makeButton(this, W / 2, H * 0.58, '▶  PLAY', () => this.scene.start('PaceSelect'), {
      width: 250,
      height: 64,
      fontSize: 28,
    });
    makeButton(this, W / 2, H * 0.68, '🌊  CURRENTS LAB', () => this.scene.start('Lab'), {
      variant: 'ghost',
      width: 250,
      height: 52,
      fontSize: 20,
      accent: 0x4aa3e0,
    });

    this.add
      .text(W / 2, H * 0.77, '3 modes · 4 creatures · 3 tempos', {
        fontFamily: FONT,
        fontSize: '16px',
        color: '#bfdde8',
      })
      .setOrigin(0.5);

    const sfx = this.registry.get('sfx') as SfxSynth;
    const mute = this.add
      .text(16, 16, sfx.isMuted() ? '🔇' : '🔊', { fontSize: '26px' })
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    mute.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      sfx.unlock();
      mute.setText(sfx.toggleMute() ? '🔇' : '🔊');
    });

    // Physics sandbox entry (Phase 1 tooling, kept for tuning sessions).
    makeButton(this, W - 60, H - 26, 'sandbox', () => this.scene.start('Sandbox'), {
      variant: 'ghost',
      width: 96,
      height: 34,
      fontSize: 14,
      accent: 0x7fa8b8,
    });
  }
}
