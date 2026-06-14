import Phaser from 'phaser';
import difficulty from '../config/difficulty.json';
import { MODES } from '../core/modes/modes';

const W = difficulty.worldWidth;
const H = difficulty.worldHeight;
const FONT = '"Trebuchet MS", sans-serif';

const BLURB: Record<string, string> = {
  classic: 'Tap to swim up.\nBuoyancy does the rest.',
  dive: 'Hold top to rise,\nbottom to dive. Both ways.',
};

/** Mode picker (v3.3 §1): Classic vs Dive. Currents Lab is dev-flag-only. */
export class ModeSelectScene extends Phaser.Scene {
  constructor() {
    super('ModeSelect');
  }

  create(): void {
    this.add.tileSprite(W / 2, H / 2, W, H, 'bgFar');
    this.add.tileSprite(W / 2, H / 2, W, H, 'bgMid');
    this.add.image(W / 2, H - 24, 'sand');

    this.add
      .text(W / 2, H * 0.13, 'CHOOSE MODE', {
        fontFamily: FONT,
        fontSize: '38px',
        fontStyle: 'bold',
        color: '#e8f6fb',
        stroke: '#0a2e3d',
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    MODES.forEach((mode, i) => {
      this.card(H * 0.32 + i * 175, mode.name, BLURB[mode.id] ?? '', () => {
        this.registry.set('modeId', mode.id);
        this.scene.start('CharacterSelect');
      });
    });

    this.backLink('◀ menu', () => this.scene.start('Menu'));
  }

  private card(cy: number, title: string, blurb: string, onPick: () => void): void {
    const c = this.add.container(W / 2, cy);
    const bg = this.add.graphics();
    bg.fillStyle(0x0a3142, 0.9);
    bg.fillRoundedRect(-180, -70, 360, 140, 16);
    bg.lineStyle(3, 0x1d8a77);
    bg.strokeRoundedRect(-180, -70, 360, 140, 16);
    c.add(bg);
    c.add(
      this.add
        .text(0, -34, title, { fontFamily: FONT, fontSize: '30px', fontStyle: 'bold', color: '#ffd97a' })
        .setOrigin(0.5),
    );
    c.add(
      this.add
        .text(0, 18, blurb, { fontFamily: FONT, fontSize: '19px', color: '#cfe9f2', align: 'center' })
        .setOrigin(0.5),
    );
    c.setSize(360, 140).setInteractive({ useHandCursor: true });
    c.on('pointerover', () => bg.setAlpha(1));
    c.on('pointerout', () => bg.setAlpha(0.9));
    c.on('pointerdown', onPick);
  }

  private backLink(label: string, onClick: () => void): void {
    this.add
      .text(14, H - 12, label, { fontFamily: FONT, fontSize: '17px', color: '#7fa8b8' })
      .setOrigin(0, 1)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', onClick);
  }
}
