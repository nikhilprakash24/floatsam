import Phaser from 'phaser';
import difficulty from '../config/difficulty.json';
import {
  CHARACTERS,
  TRAIT_ORDER,
  overallRating,
  type CharacterProfile,
  type Rarity,
} from '../core/character/CharacterProfile';
import { modeById } from '../core/modes/modes';
import { bestKeyFor } from '../core/score/score';
import type { KVStore } from '../platform/Storage';
import { makeBackButton } from '../ui/Button';

const W = difficulty.worldWidth;
const H = difficulty.worldHeight;
const FONT = '"Trebuchet MS", sans-serif';

const RARITY_COLOR: Record<Rarity, number> = {
  common: 0x9fb0b8,
  uncommon: 0x5fb87a,
  rare: 0x4aa3e0,
  epic: 0xb06fd6,
};

const CARD_W = 344;
const CARD_H = 468;

/** Trading-card character picker (carousel of one big card with prev/next). */
export class CharacterSelectScene extends Phaser.Scene {
  private index = 0;
  private cardContainer?: Phaser.GameObjects.Container;
  private modeId = 'classic';
  private store!: KVStore;

  constructor() {
    super('CharacterSelect');
  }

  create(): void {
    this.add.tileSprite(W / 2, H / 2, W, H, 'bgFar');
    this.add.tileSprite(W / 2, H / 2, W, H, 'bgMid');
    this.add.image(W / 2, H - 24, 'sand');

    this.modeId = this.registry.get('modeId') as string;
    this.store = this.registry.get('store') as KVStore;
    const mode = modeById(this.modeId);

    // Resume on the last-played character if any.
    const last = this.registry.get('characterId') as string;
    const li = CHARACTERS.findIndex((c) => c.id === last);
    this.index = li >= 0 ? li : 0;

    this.add
      .text(W / 2, 64, 'CHOOSE CREATURE', {
        fontFamily: FONT,
        fontSize: '28px',
        fontStyle: 'bold',
        color: '#e8f6fb',
        stroke: '#0a2e3d',
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    this.add
      .text(W / 2, 90, `mode: ${mode.name}`, { fontFamily: FONT, fontSize: '16px', color: '#9fd8cf' })
      .setOrigin(0.5);

    // Prev / next arrows.
    this.arrow(26, '‹', -1);
    this.arrow(W - 26, '›', 1);

    const prompt = this.add
      .text(W / 2, H - 34, 'tap card to play', {
        fontFamily: FONT,
        fontSize: '22px',
        color: '#ffd97a',
        stroke: '#0a2e3d',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.4, duration: 650, yoyo: true, repeat: -1 });

    makeBackButton(this, '◀ modes', () => this.scene.start('ModeSelect'));

    this.renderCard();
  }

  private arrow(x: number, glyph: string, dir: number): void {
    this.add
      .text(x, H * 0.45, glyph, { fontFamily: FONT, fontSize: '54px', color: '#cfe9f2' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation();
        this.index = (this.index + dir + CHARACTERS.length) % CHARACTERS.length;
        this.renderCard();
      });
  }

  private renderCard(): void {
    this.cardContainer?.destroy();
    const char = CHARACTERS[this.index]!;
    const accent = RARITY_COLOR[char.card.rarity];
    const cx = W / 2;
    const cy = H * 0.475;
    const c = this.add.container(cx, cy);
    const left = -CARD_W / 2;
    const top = -CARD_H / 2;

    const g = this.add.graphics();
    g.fillStyle(0x0b3344, 0.97);
    g.fillRoundedRect(left, top, CARD_W, CARD_H, 18);
    g.lineStyle(4, accent, 1);
    g.strokeRoundedRect(left, top, CARD_W, CARD_H, 18);
    // Header band.
    g.fillStyle(accent, 0.16);
    g.fillRoundedRect(left + 6, top + 6, CARD_W - 12, 52, { tl: 14, tr: 14, bl: 0, br: 0 });
    // Portrait panel.
    g.fillStyle(0x07222d, 0.85);
    g.fillRoundedRect(left + 18, top + 70, CARD_W - 36, 120, 12);
    c.add(g);

    // Header: number, rarity, OVR badge.
    c.add(
      this.add.text(left + 18, top + 20, `#${char.card.number}`, {
        fontFamily: FONT,
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#e8f6fb',
      }),
    );
    c.add(
      this.add
        .text(0, top + 32, char.card.rarity.toUpperCase(), {
          fontFamily: FONT,
          fontSize: '14px',
          color: Phaser.Display.Color.IntegerToColor(accent).rgba,
        })
        .setOrigin(0.5),
    );
    const ovr = overallRating(char.card);
    const badge = this.add.graphics();
    badge.fillStyle(accent, 1);
    badge.fillCircle(CARD_W / 2 - 30, top + 32, 22);
    c.add(badge);
    c.add(
      this.add
        .text(CARD_W / 2 - 30, top + 24, String(ovr), {
          fontFamily: FONT,
          fontSize: '22px',
          fontStyle: 'bold',
          color: '#06222d',
        })
        .setOrigin(0.5),
    );
    c.add(
      this.add
        .text(CARD_W / 2 - 30, top + 44, 'OVR', { fontFamily: FONT, fontSize: '11px', color: '#06222d' })
        .setOrigin(0.5),
    );

    // Portrait.
    c.add(this.add.image(0, top + 130, char.id).setScale(char.id === 'puffer' ? 1.5 : 2.2));

    // Name + role.
    c.add(
      this.add
        .text(0, top + 212, char.name, { fontFamily: FONT, fontSize: '30px', fontStyle: 'bold', color: '#ffd97a' })
        .setOrigin(0.5),
    );
    c.add(
      this.add
        .text(0, top + 240, char.card.role, { fontFamily: FONT, fontSize: '17px', color: '#9fd8cf' })
        .setOrigin(0.5),
    );

    // Stat rows with pips.
    const statY = top + 262;
    TRAIT_ORDER.forEach((key, i) => {
      const y = statY + i * 24;
      c.add(
        this.add.text(left + 26, y, key.toUpperCase(), {
          fontFamily: FONT,
          fontSize: '14px',
          color: '#bfdde8',
        }),
      );
      const val = char.card.traits[key];
      for (let p = 0; p < 5; p++) {
        const pip = this.add.graphics();
        pip.fillStyle(p < val ? accent : 0x10323f, 1);
        pip.fillRoundedRect(left + 150 + p * 30, y, 24, 13, 3);
        c.add(pip);
      }
    });

    // Flavor + best.
    c.add(
      this.add
        .text(0, top + 392, char.card.flavor, {
          fontFamily: FONT,
          fontSize: '13px',
          color: '#cfe9f2',
          align: 'center',
          wordWrap: { width: CARD_W - 48 },
        })
        .setOrigin(0.5, 0),
    );
    const best = Number(this.store.get(bestKeyFor(this.modeId, char.id)) ?? 0);
    c.add(
      this.add
        .text(0, CARD_H / 2 - 18, `best  ${best}`, { fontFamily: FONT, fontSize: '14px', color: '#8fb6c4' })
        .setOrigin(0.5),
    );

    c.setSize(CARD_W, CARD_H).setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => this.pick(char));
    c.setScale(0.92).setAlpha(0);
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 180, ease: 'Back.easeOut' });
    this.cardContainer = c;
  }

  private pick(char: CharacterProfile): void {
    this.registry.set('characterId', char.id);
    this.scene.start('Game');
  }
}
