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
    this.add.image(W / 2, H / 2, 'seamounts');
    this.add.tileSprite(W / 2, H / 2, W, H, 'bgFar');
    this.add.tileSprite(W / 2, H / 2, W, H, 'bgMid');
    this.add.image(W / 2, H - 24, 'sand');

    // A8: per-letter wave title (calm = static).
    this.waveTitle('UNDERWATER', H * 0.13, 48);
    this.waveTitle('FLAPPY', H * 0.215, 48);

    const seal = this.add.sprite(W / 2, H * 0.4, 'seal').setScale(1.6);
    if (this.anims.exists('swim-seal')) seal.play('swim-seal');
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
    makeButton(this, W / 2, H * 0.675, '🌊  CURRENTS LAB', () => this.scene.start('Lab'), {
      variant: 'ghost',
      width: 250,
      height: 50,
      fontSize: 20,
      accent: 0x4aa3e0,
    });
    makeButton(this, W / 2, H * 0.752, '✨  FABLE CURRENTS', () => this.scene.start('FableLab'), {
      variant: 'ghost',
      width: 250,
      height: 44,
      fontSize: 18,
      accent: 0x8f6fd6,
    });
    makeButton(this, W / 2, H * 0.822, '🗂  CURRENTS CATALOG', () => this.scene.start('Catalog'), {
      variant: 'ghost',
      width: 250,
      height: 44,
      fontSize: 18,
      accent: 0x4ad0c0,
    });

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

  /** A8: title as individual letters riding a gentle wave. */
  private waveTitle(text: string, y: number, size: number): void {
    const style = {
      fontFamily: FONT,
      fontSize: `${size}px`,
      fontStyle: 'bold',
      color: '#e8f6fb',
      stroke: '#0a2e3d',
      strokeThickness: 8,
    };
    const letters = [...text].map((ch) => this.add.text(0, y, ch, style).setOrigin(0.5));
    const total = letters.reduce((s, l) => s + l.width - 6, 0);
    let x = W / 2 - total / 2;
    letters.forEach((l, i) => {
      l.setX(x + (l.width - 6) / 2);
      x += l.width - 6;
      if (!prefersReducedMotion()) {
        this.tweens.add({
          targets: l,
          y: y + 6,
          duration: 1500,
          delay: i * 110,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    });
  }
}
