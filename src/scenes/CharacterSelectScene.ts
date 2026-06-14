import Phaser from 'phaser';
import difficulty from '../config/difficulty.json';
import { CHARACTERS } from '../core/character/CharacterProfile';
import { modeById } from '../core/modes/modes';
import { bestKeyFor } from '../core/score/score';
import type { KVStore } from '../platform/Storage';

const W = difficulty.worldWidth;
const H = difficulty.worldHeight;
const FONT = '"Trebuchet MS", sans-serif';

const BLURB: Record<string, string> = {
  seal: 'Balanced. The original.',
  otter: 'Light & nimble.\nWeaker flap, smaller target.',
};

/** Character picker (v3.3 §1): valid in every mode. */
export class CharacterSelectScene extends Phaser.Scene {
  constructor() {
    super('CharacterSelect');
  }

  create(): void {
    this.add.tileSprite(W / 2, H / 2, W, H, 'bgFar');
    this.add.tileSprite(W / 2, H / 2, W, H, 'bgMid');
    this.add.image(W / 2, H - 24, 'sand');

    const modeId = this.registry.get('modeId') as string;
    const mode = modeById(modeId);
    const store = this.registry.get('store') as KVStore;

    this.add
      .text(W / 2, H * 0.12, 'CHOOSE CREATURE', {
        fontFamily: FONT,
        fontSize: '34px',
        fontStyle: 'bold',
        color: '#e8f6fb',
        stroke: '#0a2e3d',
        strokeThickness: 6,
      })
      .setOrigin(0.5);
    this.add
      .text(W / 2, H * 0.18, `mode: ${mode.name}`, {
        fontFamily: FONT,
        fontSize: '18px',
        color: '#9fd8cf',
      })
      .setOrigin(0.5);

    CHARACTERS.forEach((char, i) => {
      const best = Number(store.get(bestKeyFor(modeId, char.id)) ?? 0);
      this.card(H * 0.32 + i * 180, char.id, char.name, BLURB[char.id] ?? '', best, () => {
        this.registry.set('characterId', char.id);
        this.scene.start('Game');
      });
    });

    this.add
      .text(14, H - 12, '◀ modes', { fontFamily: FONT, fontSize: '17px', color: '#7fa8b8' })
      .setOrigin(0, 1)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('ModeSelect'));
  }

  private card(
    cy: number,
    texture: string,
    title: string,
    blurb: string,
    best: number,
    onPick: () => void,
  ): void {
    const c = this.add.container(W / 2, cy);
    const bg = this.add.graphics();
    bg.fillStyle(0x0a3142, 0.9);
    bg.fillRoundedRect(-185, -72, 370, 144, 16);
    bg.lineStyle(3, 0x1d8a77);
    bg.strokeRoundedRect(-185, -72, 370, 144, 16);
    c.add(bg);
    c.add(this.add.image(-128, 0, texture).setScale(1.5));
    c.add(
      this.add
        .text(-60, -42, title, { fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: '#ffd97a' })
        .setOrigin(0, 0.5),
    );
    c.add(
      this.add
        .text(-60, -4, blurb, { fontFamily: FONT, fontSize: '17px', color: '#cfe9f2' })
        .setOrigin(0, 0.5),
    );
    c.add(
      this.add
        .text(-60, 44, `best  ${best}`, { fontFamily: FONT, fontSize: '17px', color: '#bfdde8' })
        .setOrigin(0, 0.5),
    );
    c.setSize(370, 144).setInteractive({ useHandCursor: true });
    c.on('pointerover', () => bg.setAlpha(1));
    c.on('pointerout', () => bg.setAlpha(0.9));
    c.on('pointerdown', onPick);
  }
}
