import Phaser from 'phaser';
import difficulty from '../config/difficulty.json';
import { makeButton, makeBackButton } from '../ui/Button';

const W = difficulty.worldWidth;
const H = difficulty.worldHeight;
const FONT = '"Trebuchet MS", sans-serif';

interface Pace {
  id: string;
  label: string;
  mult: number;
  blurb: string;
  accent: number;
}

/** Global tempo wrapper — scales scroll speed on top of mode × character. */
const PACES: Pace[] = [
  { id: 'base', label: 'Base', mult: 1.0, blurb: 'Standard tempo.', accent: 0x1d8a77 },
  { id: 'faster', label: 'Faster', mult: 1.2, blurb: '+20% — everything moves quicker.', accent: 0xd9a441 },
  { id: 'turbo', label: 'Turbo', mult: 1.4, blurb: '+40% — a reflex test.', accent: 0xd9566a },
];

export class PaceSelectScene extends Phaser.Scene {
  constructor() {
    super('PaceSelect');
  }

  create(): void {
    this.add.image(W / 2, H / 2, 'bgGradient');
    this.add.tileSprite(W / 2, H / 2, W, H, 'bgFar');
    this.add.tileSprite(W / 2, H / 2, W, H, 'bgMid');
    this.add.image(W / 2, H - 24, 'sand');

    this.add
      .text(W / 2, H * 0.14, 'CHOOSE TEMPO', {
        fontFamily: FONT,
        fontSize: '36px',
        fontStyle: 'bold',
        color: '#e8f6fb',
        stroke: '#0a2e3d',
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    PACES.forEach((p, i) => {
      const y = H * 0.3 + i * 130;
      makeButton(this, W / 2, y, p.label, () => this.choose(p), {
        width: 300,
        height: 64,
        fontSize: 26,
        accent: p.accent,
      });
      this.add
        .text(W / 2, y + 44, p.blurb, { fontFamily: FONT, fontSize: '16px', color: '#bfdde8' })
        .setOrigin(0.5);
    });

    makeBackButton(this, '◀ menu', () => this.scene.start('Menu'));
  }

  private choose(p: Pace): void {
    this.registry.set('pace', p.mult);
    this.registry.set('paceId', p.id);
    this.scene.start('ModeSelect');
  }
}
