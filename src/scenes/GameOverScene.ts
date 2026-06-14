import Phaser from 'phaser';
import difficulty from '../config/difficulty.json';
import { makeButton } from '../ui/Button';

const W = difficulty.worldWidth;
const H = difficulty.worldHeight;
const FONT = '"Trebuchet MS", sans-serif';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(data: { score: number; best: number }): void {
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x04141c, 0).setDepth(0);
    this.tweens.add({ targets: dim, fillAlpha: 0.55, duration: 250 });

    const panel = this.add.container(W / 2, H * 0.42).setDepth(1);
    const bg = this.add.graphics();
    bg.fillStyle(0x0a3142, 0.95);
    bg.fillRoundedRect(-160, -120, 320, 240, 18);
    bg.lineStyle(3, 0x1d8a77);
    bg.strokeRoundedRect(-160, -120, 320, 240, 18);
    panel.add(bg);

    panel.add(
      this.add
        .text(0, -82, 'glub glub…', {
          fontFamily: FONT,
          fontSize: '30px',
          fontStyle: 'bold',
          color: '#e8f6fb',
        })
        .setOrigin(0.5),
    );

    panel.add(
      this.add
        .text(0, -26, `score  ${data.score}`, {
          fontFamily: FONT,
          fontSize: '34px',
          color: '#ffffff',
        })
        .setOrigin(0.5),
    );

    const isRecord = data.score >= data.best && data.score > 0;
    panel.add(
      this.add
        .text(0, 22, isRecord ? 'new best!' : `best  ${data.best}`, {
          fontFamily: FONT,
          fontSize: '24px',
          color: isRecord ? '#ffd97a' : '#bfdde8',
        })
        .setOrigin(0.5),
    );

    panel.setScale(0.7).setAlpha(0);
    this.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });

    const leave = (target: string): void => {
      this.scene.stop('Hud');
      this.scene.stop('Game');
      this.scene.stop();
      this.scene.start(target);
    };

    // Buttons appear after a brief guard so a death-tap can't instantly restart.
    this.time.delayedCall(350, () => {
      // GameScene.create owns the →PLAY transition.
      const again = makeButton(this, W / 2, H * 0.42 + 78, '▶  PLAY AGAIN', () => leave('Game'), {
        width: 240,
        height: 54,
        fontSize: 22,
      }).setDepth(2);
      const change = makeButton(this, W / 2, H * 0.42 + 142, 'change mode / creature', () => leave('ModeSelect'), {
        variant: 'ghost',
        width: 240,
        height: 44,
        fontSize: 17,
        accent: 0x4aa3e0,
      }).setDepth(2);
      for (const b of [again, change]) {
        b.setScale(0.8).setAlpha(0);
        this.tweens.add({ targets: b, scale: 1, alpha: 1, duration: 160, ease: 'Back.easeOut' });
      }
    });
  }
}
