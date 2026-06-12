import Phaser from 'phaser';
import difficulty from '../config/difficulty.json';

const W = difficulty.worldWidth;
const H = difficulty.worldHeight;

/** Shown when the tab loses visibility mid-run; resumes on tap. */
export class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  create(): void {
    this.add.rectangle(W / 2, H / 2, W, H, 0x04141c, 0.6);
    const label = this.add
      .text(W / 2, H * 0.45, 'paused\n\ntap to resume', {
        fontFamily: '"Trebuchet MS", sans-serif',
        fontSize: '30px',
        color: '#e8f6fb',
        align: 'center',
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: label, alpha: 0.5, duration: 700, yoyo: true, repeat: -1 });

    this.input.once('pointerdown', () => {
      this.scene.resume('Game');
      this.scene.stop();
    });
  }
}
